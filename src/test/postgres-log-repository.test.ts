import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IngestLogEntry } from "../dto/ingest-request.js";
import { MissingLogsTableError } from "../errors/missing-logs-table-error.js";
import { MAX_LOGS_PER_INSERT } from "../repositories/postgres/log-bulk-insert-query.js";

const mockConnect = vi.fn();
const mockQuery = vi.fn();
const mockRelease = vi.fn();

vi.mock("../config/database.js", () => ({
  pool: {
    connect: mockConnect,
  },
}));

describe("PostgresLogRepository", () => {
  beforeEach(() => {
    mockConnect.mockReset();
    mockQuery.mockReset();
    mockRelease.mockReset();
  });

  function createEntry(index: number): IngestLogEntry {
    return {
      timestamp: `2026-08-03T10:00:${String(index % 60).padStart(2, "0")}.000Z`,
      level: "info",
      service: "checkout",
      message: `event-${index}`,
    };
  }

  it("persists logs with one query per chunk", async () => {
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
    mockQuery.mockResolvedValue({ rowCount: 2 });

    const { PostgresLogRepository } = await import("../repositories/postgres/log-repository.js");
    const repository = new PostgresLogRepository();
    const entries: IngestLogEntry[] = [
      {
        timestamp: "2026-08-03T10:00:00.000Z",
        level: "info",
        service: "checkout",
        message: "created",
        attributes: { requestId: "req-1" },
      },
      {
        timestamp: "2026-08-03T10:00:01.000Z",
        level: "error",
        service: "billing",
        message: "failed",
      },
    ];

    await repository.saveLogs(entries);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO public.logs"),
      expect.any(Array)
    );
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("splits very large batches into multiple insert queries", async () => {
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
    mockQuery.mockResolvedValue({ rowCount: MAX_LOGS_PER_INSERT });

    const { PostgresLogRepository } = await import("../repositories/postgres/log-repository.js");
    const repository = new PostgresLogRepository();
    const entries = Array.from({ length: MAX_LOGS_PER_INSERT + 1 }, (_, index) =>
      createEntry(index)
    );

    await repository.saveLogs(entries);

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[0]?.[1]).toHaveLength(MAX_LOGS_PER_INSERT * 5);
    expect(mockQuery.mock.calls[1]?.[1]).toHaveLength(5);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("does not connect when there are no logs to persist", async () => {
    const { PostgresLogRepository } = await import("../repositories/postgres/log-repository.js");
    const repository = new PostgresLogRepository();

    await repository.saveLogs([]);

    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("throws a typed error when the logs table is missing", async () => {
    mockConnect.mockResolvedValue({
      query: mockQuery.mockResolvedValueOnce({ rows: [{ table_name: null }] }),
      release: mockRelease,
    });

    const { PostgresLogRepository } = await import("../repositories/postgres/log-repository.js");
    const repository = new PostgresLogRepository();

    await expect(repository.ensureSchemaReady()).rejects.toBeInstanceOf(MissingLogsTableError);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});
