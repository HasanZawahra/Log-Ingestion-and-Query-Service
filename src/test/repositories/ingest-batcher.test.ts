import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_LOGS_PER_INSERT } from "../../constants/log.js";
import type { IngestLogEntry } from "../../dto/ingest/ingest-request.js";

const mockConnect = vi.fn();
const mockQuery = vi.fn();
const mockRelease = vi.fn();

vi.mock("../../config/database.js", () => ({
  pool: {
    connect: mockConnect,
  },
}));

function createEntry(index: number): IngestLogEntry {
  return {
    timestamp: `2026-08-03T10:00:${String(index % 60).padStart(2, "0")}.000Z`,
    level: "info",
    service: "checkout",
    message: `event-${index}`,
  };
}

describe("IngestBatcher", () => {
  beforeEach(() => {
    // Reset the database mock before each concurrency scenario.
    mockConnect.mockReset();
    mockQuery.mockReset();
    mockRelease.mockReset();
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
    mockQuery.mockResolvedValue({ rowCount: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function createBatcher(
    overrides: Partial<{
      targetFlushSize: number;
      maxConcurrentFlushes: number;
    }> = {}
  ) {
    const { IngestBatcher } = await import("../../repositories/postgres/ingest-batcher.js");
    return new IngestBatcher({
      targetFlushSize: MAX_LOGS_PER_INSERT,
      maxConcurrentFlushes: 2,
      ...overrides,
    });
  }

  it("coalesces concurrent saves into one flush", async () => {
    // Two saves arriving together should share a single transaction.
    const batcher = await createBatcher();

    const first = batcher.save([createEntry(0)]);
    const second = batcher.save([createEntry(1)]);

    await Promise.all([first, second]);

    const insertCalls = mockQuery.mock.calls.filter((call) =>
      String(call[0]).includes("INSERT INTO public.logs")
    );
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]?.[1]).toHaveLength(10);
  });

  it("flushes as soon as the target flush size is reached", async () => {
    const batcher = await createBatcher();

    await batcher.save(
      Array.from({ length: MAX_LOGS_PER_INSERT }, (_, index) => createEntry(index))
    );
    await batcher.save([createEntry(999)]);

    const insertCalls = mockQuery.mock.calls.filter((call) =>
      String(call[0]).includes("INSERT INTO public.logs")
    );
    expect(insertCalls.length).toBeGreaterThanOrEqual(1);
    expect(insertCalls[0]?.[1]).toHaveLength(MAX_LOGS_PER_INSERT * 5);
  });

  it("persists entries in a transaction with an aggregate upsert", async () => {
    const batcher = await createBatcher();

    await batcher.save([createEntry(0)]);

    expect(mockQuery.mock.calls.map((call) => String(call[0]))).toEqual([
      "BEGIN",
      expect.stringContaining("INSERT INTO public.logs"),
      expect.stringContaining("INSERT INTO public.log_minute_aggregates"),
      "COMMIT",
    ]);
  });

  it("rejects waiting saves when a flush fails", async () => {
    mockQuery.mockRejectedValueOnce(new Error("connection lost"));
    const batcher = await createBatcher();

    await expect(batcher.save([createEntry(0)])).rejects.toThrow("connection lost");
  });

  it("does not flush when there is nothing queued", async () => {
    const batcher = await createBatcher();
    await batcher.flushPending();

    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("rejects saves after close", async () => {
    const batcher = await createBatcher();
    batcher.close();

    await expect(batcher.save([createEntry(0)])).rejects.toThrow("closed");
  });
});
