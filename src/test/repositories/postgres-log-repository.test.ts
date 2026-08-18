import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_LOGS_PER_INSERT } from "../../constants/log.js";
import type { IngestLogEntry } from "../../dto/ingest/ingest-request.js";
import type { LogAggregateRequest } from "../../dto/log-aggregate/log-aggregate-request.js";
import type { LogAggregateResponse } from "../../dto/log-aggregate/log-aggregate-response.js";
import type { LogQueryRequest } from "../../dto/log-query/log-query-request.js";
import { encodeLogCursor } from "../../utils/log-cursor.js";
import { MissingLogsTableError } from "../../errors/database/missing-logs-table-error.js";

const mockConnect = vi.fn();
const mockQuery = vi.fn();
const mockRelease = vi.fn();

vi.mock("../../config/database.js", () => ({
  pool: {
    connect: mockConnect,
  },
}));

describe("PostgresLogRepository", () => {
  beforeEach(() => {
    // Each test gets a fresh set of database call counters.
    mockConnect.mockReset();
    mockQuery.mockReset();
    mockRelease.mockReset();
  });

  function createEntry(index: number): IngestLogEntry {
    // Helper for generating predictable ingest rows.
    return {
      timestamp: `2026-08-03T10:00:${String(index % 60).padStart(2, "0")}.000Z`,
      level: "info",
      service: "checkout",
      message: `event-${index}`,
    };
  }

  it("persists logs via the ingest batcher within a transaction", async () => {
    // A normal save should result in one transactional flush.
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
    mockQuery.mockResolvedValue({ rowCount: 2 });

    const { PostgresLogRepository } = await import("../../repositories/postgres/log-repository.js");
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

    expect(mockQuery.mock.calls.map((call) => call[0])).toEqual([
      "BEGIN",
      expect.stringContaining("INSERT INTO public.logs"),
      expect.stringContaining("INSERT INTO public.log_minute_aggregates"),
      "COMMIT",
    ]);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("splits very large batches into multiple insert queries", async () => {
    // Oversized batches must be split to stay under statement limits.
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
    mockQuery.mockResolvedValue({ rowCount: MAX_LOGS_PER_INSERT });

    const { PostgresLogRepository } = await import("../../repositories/postgres/log-repository.js");
    const repository = new PostgresLogRepository();
    const entries = Array.from({ length: MAX_LOGS_PER_INSERT + 1 }, (_, index) =>
      createEntry(index)
    );

    await repository.saveLogs(entries);

    const insertCalls = mockQuery.mock.calls.filter((call) =>
      String(call[0]).includes("INSERT INTO public.logs")
    );
    expect(insertCalls).toHaveLength(2);
    expect(insertCalls[0]?.[1]).toHaveLength(MAX_LOGS_PER_INSERT * 5);
    expect(insertCalls[1]?.[1]).toHaveLength(5);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("does not connect when there are no logs to persist", async () => {
    // Empty writes should short-circuit before touching the database.
    const { PostgresLogRepository } = await import("../../repositories/postgres/log-repository.js");
    const repository = new PostgresLogRepository();

    await repository.saveLogs([]);

    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("throws a typed error when the logs table is missing", async () => {
    // Schema probes should fail loudly when the table is absent.
    mockConnect.mockResolvedValue({
      query: mockQuery.mockResolvedValueOnce({ rows: [{ table_name: null }] }),
      release: mockRelease,
    });

    const { PostgresLogRepository } = await import("../../repositories/postgres/log-repository.js");
    const repository = new PostgresLogRepository();

    await expect(repository.ensureSchemaReady()).rejects.toBeInstanceOf(MissingLogsTableError);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("queries logs using the injected query builder", async () => {
    // The repository should fetch one extra row to compute next_cursor.
    const buildLogQuery = vi.fn().mockReturnValue({
      text: "SELECT id, timestamp, level, service, message, attributes FROM public.logs LIMIT $1",
      values: [2],
    });

    mockConnect.mockResolvedValue({
      query: mockQuery.mockResolvedValue({
        rows: [
          {
            id: 9,
            timestamp: new Date("2026-08-03T10:00:00.000Z"),
            level: "info",
            service: "checkout",
            message: "created",
            attributes: {},
          },
          {
            id: 8,
            timestamp: new Date("2026-08-03T09:59:00.000Z"),
            level: "info",
            service: "checkout",
            message: "older",
            attributes: {},
          },
        ],
      }),
      release: mockRelease,
    });

    const { PostgresLogRepository } = await import("../../repositories/postgres/log-repository.js");
    const repository = new PostgresLogRepository({ buildLogQuery } as never);

    const request: LogQueryRequest = {
      service: "checkout",
      limit: 1,
      cursor: encodeLogCursor({
        timestamp: "2026-08-03T10:01:00.000Z",
        id: 10,
      }),
    };

    const response = await repository.queryLogs(request);

    expect(buildLogQuery).toHaveBeenCalledWith({
      ...request,
      limit: 2,
    });
    expect(mockQuery).toHaveBeenCalledWith(
      "SELECT id, timestamp, level, service, message, attributes FROM public.logs LIMIT $1",
      [2]
    );
    expect(response.logs).toHaveLength(1);
    expect(response.logs[0]).toEqual({
      id: "9",
      timestamp: "2026-08-03T10:00:00.000Z",
      level: "info",
      service: "checkout",
      message: "created",
      attributes: {},
    });
    expect(response.next_cursor).toEqual(
      encodeLogCursor({
        timestamp: "2026-08-03T10:00:00.000Z",
        id: 9,
      })
    );
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("queries log aggregates using the injected aggregate query builder", async () => {
    // Aggregate reads should simply map rows into the public response shape.
    const buildLogAggregateQuery = vi.fn().mockReturnValue({
      text: 'SELECT date_trunc(\'minute\', timestamp) AS start, NULL::text AS "group", COUNT(*)::int AS count FROM public.logs WHERE timestamp >= $1 AND timestamp < $2 GROUP BY 1, 2 ORDER BY start ASC, "group" ASC NULLS FIRST',
      values: ["2026-08-03T10:00:00.000Z", "2026-08-03T11:00:00.000Z"],
    });

    mockConnect.mockResolvedValue({
      query: mockQuery.mockResolvedValue({
        rows: [
          {
            start: new Date("2026-08-03T10:00:00.000Z"),
            group: "checkout",
            count: "118",
          },
          {
            start: new Date("2026-08-03T10:01:00.000Z"),
            group: null,
            count: 42,
          },
        ],
      }),
      release: mockRelease,
    });

    const { PostgresLogRepository } = await import("../../repositories/postgres/log-repository.js");
    const repository = new PostgresLogRepository(
      undefined as never,
      { buildLogAggregateQuery } as never
    );

    const request: LogAggregateRequest = {
      since: "2026-08-03T10:00:00.000Z",
      until: "2026-08-03T11:00:00.000Z",
      bucket: "1m",
    };

    const response = await repository.queryLogAggregates(request);

    expect(buildLogAggregateQuery).toHaveBeenCalledWith(request);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT date_trunc('minute', timestamp) AS start"),
      ["2026-08-03T10:00:00.000Z", "2026-08-03T11:00:00.000Z"]
    );
    expect(response).toEqual({
      buckets: [
        {
          start: "2026-08-03T10:00:00.000Z",
          group: "checkout",
          count: 118,
        },
        {
          start: "2026-08-03T10:01:00.000Z",
          group: null,
          count: 42,
        },
      ],
    } satisfies LogAggregateResponse);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});
