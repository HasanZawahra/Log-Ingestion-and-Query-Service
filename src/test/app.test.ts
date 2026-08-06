import { describe, expect, it, vi } from "vitest";
import { HealthController } from "../controllers/health-controller.js";
import { MalformedJsonError } from "../errors/malformed-json-error.js";
import { InvalidLogQueryError } from "../errors/invalid-log-query-error.js";
import { InvalidLogCursorError } from "../errors/invalid-log-cursor-error.js";
import type { IHealthService } from "../services/interfaces/health-service.js";
import { applicationErrorHandler, jsonParseErrorHandler } from "../utils/middleware.js";

describe("GET /health", () => {
  it("returns ok when the database is healthy", async () => {
    const healthService: IHealthService = {
      checkHealth: vi.fn().mockResolvedValueOnce(true),
    };
    const controller = new HealthController(healthService);

    const response = await new Promise<{ status: number; body: { status: string } }>((resolve) => {
      const req = { method: "GET", url: "/health" };
      const res = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        setHeader() {
          return this;
        },
        end() {
          return this;
        },
        json(payload: { status: string }) {
          resolve({ status: this.statusCode, body: payload });
        },
      };

      controller.getHealth(req as never, res as never);
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns unavailable when the database is not healthy", async () => {
    const healthService: IHealthService = {
      checkHealth: vi.fn().mockResolvedValueOnce(false),
    };
    const controller = new HealthController(healthService);

    await expect(
      controller.getHealth({ method: "GET", url: "/health" } as never, {} as never)
    ).rejects.toMatchObject({
      message: "unavailable",
    });
  });
});

describe("POST /logs", () => {
  it("converts malformed JSON into a custom application error", () => {
    const next = vi.fn();
    const error = new SyntaxError("Unexpected end of JSON input") as SyntaxError & { body: string };
    error.body = '{"entries":[';

    jsonParseErrorHandler(error, {} as never, {} as never, next as never);

    expect(next).toHaveBeenCalledWith(expect.any(MalformedJsonError));
  });

  it("serializes application errors into responses", async () => {
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

      applicationErrorHandler(
        new MalformedJsonError(),
        {} as never,
        res as never,
        vi.fn() as never
      );
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "malformed JSON",
    });
  });

  it("serializes cursor errors into responses", async () => {
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

      applicationErrorHandler(
        new InvalidLogCursorError(),
        {} as never,
        res as never,
        vi.fn() as never
      );
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "cursor must be a valid base64url-encoded log cursor",
    });
  });

  it("serializes query validation errors into responses", async () => {
    const response = await new Promise<{ status: number; body: { error: string; issues: string[] } }>((resolve) => {
      const res = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: { error: string; issues: string[] }) {
          resolve({ status: this.statusCode, body: payload });
          return this;
        },
      };

      applicationErrorHandler(
        new InvalidLogQueryError(["limit must be an integer between 1 and 1000"]),
        {} as never,
        res as never,
        vi.fn() as never
      );
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "invalid log query",
      issues: ["limit must be an integer between 1 and 1000"],
    });
  });
});
