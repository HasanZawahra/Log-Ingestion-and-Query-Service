import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IngestLogEntry } from "../dto/ingest-request.js";

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

  it("persists logs with one multi-row insert", async () => {
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
      expect.stringContaining("VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)"),
      [
        "2026-08-03T10:00:00.000Z",
        "info",
        "checkout",
        "created",
        { requestId: "req-1" },
        "2026-08-03T10:00:01.000Z",
        "error",
        "billing",
        "failed",
        {},
      ]
    );
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("does not connect when there are no logs to persist", async () => {
    const { PostgresLogRepository } = await import("../repositories/postgres/log-repository.js");
    const repository = new PostgresLogRepository();

    await repository.saveLogs([]);

    expect(mockConnect).not.toHaveBeenCalled();
  });
});
