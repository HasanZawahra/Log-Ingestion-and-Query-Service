import { describe, expect, it, vi } from "vitest";
import type { IngestRequest } from "../../dto/ingest/ingest-request.js";
import type { LogAggregateResponse } from "../../dto/log-aggregate/log-aggregate-response.js";
import type { LogQueryResponse } from "../../dto/log-query/log-query-response.js";
import { AllEntriesRejectedError } from "../../errors/logs/all-entries-rejected-error.js";
import { InvalidLogAggregateError } from "../../errors/logs/invalid-log-aggregate-error.js";
import { InvalidLogQueryError } from "../../errors/logs/invalid-log-query-error.js";
import { LogService } from "../../services/implementations/log-service.js";
import type { ILogRepository } from "../../repositories/interfaces/log-repository.js";

describe("LogService", () => {
  it("validates and persists only valid entries", async () => {
    const saveLogs = vi.fn().mockResolvedValue(undefined);
    const repository: ILogRepository = {
      ensureSchemaReady: vi.fn(),
      saveLogs,
      queryLogs: vi.fn(),
      queryLogAggregates: vi.fn(),
    };

    const service = new LogService(repository);
    const request: IngestRequest = {
      entries: [
        {
          timestamp: new Date(Date.now() - 60_000).toISOString(),
          level: "info",
          service: "checkout",
          message: "created",
        },
        {
          timestamp: new Date(Date.now() + 10 * 60_000).toISOString(),
          level: "warn",
          service: "billing",
          message: "",
        },
      ],
    };

    const response = await service.ingestLogs(request);

    expect(saveLogs).toHaveBeenCalledWith([
      {
        timestamp: request.entries[0]?.timestamp,
        level: "info",
        service: "checkout",
        message: "created",
      },
    ]);
    expect(response.accepted).toBe(1);
    expect(response.rejected).toBe(1);
    expect(response.rejectedEntries[0]?.reason).toContain("message");
  });

  it("throws when every entry is rejected", async () => {
    const saveLogs = vi.fn();
    const repository: ILogRepository = {
      ensureSchemaReady: vi.fn(),
      saveLogs,
      queryLogs: vi.fn(),
      queryLogAggregates: vi.fn(),
    };

    const service = new LogService(repository);

    await expect(
      service.ingestLogs({
        entries: [
          {
            timestamp: new Date(Date.now() + 10 * 60_000).toISOString(),
            level: "warn",
            service: "billing",
            message: "",
          },
        ],
      })
    ).rejects.toBeInstanceOf(AllEntriesRejectedError);

    expect(saveLogs).not.toHaveBeenCalled();
  });

  it("validates query parameters before querying logs", async () => {
    const queryLogs = vi.fn().mockResolvedValue({
      entries: [],
      next_cursor: null,
    } satisfies LogQueryResponse);
    const repository: ILogRepository = {
      ensureSchemaReady: vi.fn(),
      saveLogs: vi.fn(),
      queryLogs,
      queryLogAggregates: vi.fn(),
    };

    const service = new LogService(repository);

    await expect(
      service.queryLogs({
        limit: "0",
      })
    ).rejects.toBeInstanceOf(InvalidLogQueryError);

    expect(queryLogs).not.toHaveBeenCalled();
  });

  it("delegates valid log queries to the repository", async () => {
    const response: LogQueryResponse = {
      entries: [
        {
          id: 9,
          timestamp: "2026-08-03T10:00:00.000Z",
          level: "info",
          service: "checkout",
          message: "created",
          attributes: {},
        },
      ],
      next_cursor: null,
    };
    const queryLogs = vi.fn().mockResolvedValue(response);
    const repository: ILogRepository = {
      ensureSchemaReady: vi.fn(),
      saveLogs: vi.fn(),
      queryLogs,
      queryLogAggregates: vi.fn(),
    };

    const service = new LogService(repository);
    const result = await service.queryLogs({
      service: "checkout",
      limit: "10",
    });

    expect(queryLogs).toHaveBeenCalledWith({
      service: "checkout",
      limit: 10,
    });
    expect(result).toEqual(response);
  });

  it("validates aggregate query parameters before querying aggregates", async () => {
    const queryLogAggregates = vi.fn().mockResolvedValue({
      buckets: [],
    } satisfies LogAggregateResponse);
    const repository: ILogRepository = {
      ensureSchemaReady: vi.fn(),
      saveLogs: vi.fn(),
      queryLogs: vi.fn(),
      queryLogAggregates,
    };

    const service = new LogService(repository);

    await expect(
      service.queryLogAggregates({
        since: "2026-08-03T11:00:00.000Z",
        until: "2026-08-03T10:00:00.000Z",
        bucket: "1m",
      })
    ).rejects.toBeInstanceOf(InvalidLogAggregateError);

    expect(queryLogAggregates).not.toHaveBeenCalled();
  });

  it("delegates valid aggregate queries to the repository", async () => {
    const response: LogAggregateResponse = {
      buckets: [
        {
          start: "2026-08-03T10:00:00.000Z",
          group: "checkout",
          count: 118,
        },
      ],
    };
    const queryLogAggregates = vi.fn().mockResolvedValue(response);
    const repository: ILogRepository = {
      ensureSchemaReady: vi.fn(),
      saveLogs: vi.fn(),
      queryLogs: vi.fn(),
      queryLogAggregates,
    };

    const service = new LogService(repository);
    const result = await service.queryLogAggregates({
      since: "2026-08-03T10:00:00.000Z",
      until: "2026-08-03T11:00:00.000Z",
      bucket: "1m",
      group_by: "service",
    });

    expect(queryLogAggregates).toHaveBeenCalledWith({
      since: "2026-08-03T10:00:00.000Z",
      until: "2026-08-03T11:00:00.000Z",
      bucket: "1m",
      groupBy: "service",
    });
    expect(result).toEqual(response);
  });
});
