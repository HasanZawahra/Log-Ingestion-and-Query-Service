import { describe, expect, it, vi } from "vitest";
import { LogController } from "../../controllers/log-controller.js";
import type { IngestRequest } from "../../dto/ingest/ingest-request.js";
import type { IngestResponse } from "../../dto/ingest/ingest-response.js";
import type { LogAggregateResponse } from "../../dto/log-aggregate/log-aggregate-response.js";
import type { LogQueryResponse } from "../../dto/log-query/log-query-response.js";
import { AllEntriesRejectedError } from "../../errors/logs/all-entries-rejected-error.js";
import { InvalidRequestBodyError } from "../../errors/http/invalid-request-body-error.js";
import type { ILogService } from "../../services/interfaces/log-service.js";

describe("LogController", () => {
  it("returns the ingest result from the log service", async () => {
    const requestBody: IngestRequest = {
      entries: [
        {
          timestamp: "2026-08-03T10:00:00.000Z",
          level: "info",
          service: "checkout",
          message: "created",
        },
      ],
    };
    const ingestResponse: IngestResponse = {
      accepted: 1,
      rejected: 0,
      rejectedEntries: [],
    };
    const logService: ILogService = {
      ingestLogs: vi.fn().mockResolvedValue(ingestResponse),
      queryLogs: vi.fn(),
      queryLogAggregates: vi.fn(),
    };
    const controller = new LogController(logService);

    const response = await new Promise<{ status: number; body: IngestResponse }>((resolve) => {
      const res = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: IngestResponse) {
          resolve({ status: this.statusCode, body: payload });
          return this;
        },
      };

      controller.ingestLogs({ body: requestBody } as never, res as never);
    });

    expect(logService.ingestLogs).toHaveBeenCalledWith(requestBody);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(ingestResponse);
  });

  it("throws when the request body does not match the expected top-level shape", async () => {
    const logService: ILogService = {
      ingestLogs: vi.fn(),
      queryLogs: vi.fn(),
      queryLogAggregates: vi.fn(),
    };
    const controller = new LogController(logService);

    await expect(
      controller.ingestLogs({ body: { entries: "not-an-array" } } as never, {} as never)
    ).rejects.toBeInstanceOf(InvalidRequestBodyError);
    expect(logService.ingestLogs).not.toHaveBeenCalled();
  });

  it("propagates service errors when every entry is rejected", async () => {
    const logService: ILogService = {
      ingestLogs: vi.fn().mockRejectedValue(
        new AllEntriesRejectedError({
          accepted: 0,
          rejected: 1,
          rejectedEntries: [
            {
              index: 0,
              reason: "message must be a non-empty string",
              entry: {
                timestamp: "2026-08-03T10:00:00.000Z",
                level: "info",
                service: "checkout",
                message: "",
              },
            },
          ],
        })
      ),
      queryLogs: vi.fn(),
      queryLogAggregates: vi.fn(),
    };
    const controller = new LogController(logService);

    await expect(
      controller.ingestLogs(
        {
          body: {
            entries: [
              {
                timestamp: "2026-08-03T10:00:00.000Z",
                level: "info",
                service: "checkout",
                message: "",
              },
            ],
          },
        } as never,
        {} as never
      )
    ).rejects.toBeInstanceOf(AllEntriesRejectedError);
  });

  it("returns query results from the log service", async () => {
    const queryResponse: LogQueryResponse = {
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
    const logService: ILogService = {
      ingestLogs: vi.fn(),
      queryLogs: vi.fn().mockResolvedValue(queryResponse),
      queryLogAggregates: vi.fn(),
    };
    const controller = new LogController(logService);

    const response = await new Promise<{ status: number; body: LogQueryResponse }>((resolve) => {
      const res = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: LogQueryResponse) {
          resolve({ status: this.statusCode, body: payload });
          return this;
        },
      };

      controller.queryLogs(
        {
          query: {
            service: "checkout",
          },
        } as never,
        res as never
      );
    });

    expect(logService.queryLogs).toHaveBeenCalledWith({ service: "checkout" });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(queryResponse);
  });

  it("returns aggregate results from the log service", async () => {
    const aggregateResponse: LogAggregateResponse = {
      buckets: [
        {
          start: "2026-08-03T10:00:00.000Z",
          group: "checkout",
          count: 118,
        },
      ],
    };
    const logService: ILogService = {
      ingestLogs: vi.fn(),
      queryLogs: vi.fn(),
      queryLogAggregates: vi.fn().mockResolvedValue(aggregateResponse),
    };
    const controller = new LogController(logService);

    const response = await new Promise<{ status: number; body: LogAggregateResponse }>(
      (resolve) => {
        const res = {
          statusCode: 200,
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(payload: LogAggregateResponse) {
            resolve({ status: this.statusCode, body: payload });
            return this;
          },
        };

        controller.queryLogAggregates(
          {
            query: {
              since: "2026-08-03T10:00:00.000Z",
              until: "2026-08-03T11:00:00.000Z",
              bucket: "1m",
            },
          } as never,
          res as never
        );
      }
    );

    expect(logService.queryLogAggregates).toHaveBeenCalledWith({
      since: "2026-08-03T10:00:00.000Z",
      until: "2026-08-03T11:00:00.000Z",
      bucket: "1m",
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(aggregateResponse);
  });
});
