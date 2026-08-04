import { describe, expect, it, vi } from "vitest";
import { LogController } from "../controllers/log-controller.js";
import type { IngestRequest } from "../dto/ingest-request.js";
import type { IngestResponse } from "../dto/ingest-response.js";
import type { ILogService } from "../services/interfaces/log-service.js";

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

  it("returns 400 when the request body does not match the expected top-level shape", async () => {
    const logService: ILogService = {
      ingestLogs: vi.fn(),
    };
    const controller = new LogController(logService);

    const response = await new Promise<{ status: number; body: { error: string } }>((resolve) => {
      const res = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: { error: string }) {
          resolve({ status: this.statusCode, body: payload });
          return this;
        },
      };

      controller.ingestLogs({ body: { entries: "not-an-array" } } as never, res as never);
    });

    expect(logService.ingestLogs).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "request body must be an object with an entries array",
    });
  });

  it("returns 400 when every entry is rejected", async () => {
    const ingestResponse: IngestResponse = {
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
    };
    const logService: ILogService = {
      ingestLogs: vi.fn().mockResolvedValue(ingestResponse),
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
        res as never
      );
    });

    expect(logService.ingestLogs).toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(response.body).toEqual(ingestResponse);
  });
});
