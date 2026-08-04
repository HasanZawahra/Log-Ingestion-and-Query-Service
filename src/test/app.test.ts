import { describe, expect, it, vi } from "vitest";
import { HealthController } from "../controllers/health-controller.js";
import type { IHealthService } from "../services/interfaces/health-service.js";
import { jsonParseErrorHandler } from "../utils/middleware.js";

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

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "unavailable" });
  });
});

describe("POST /logs", () => {
  it("returns 400 for malformed JSON", async () => {
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

      const error = new SyntaxError("Unexpected end of JSON input") as SyntaxError & { body: string };
      error.body = '{"entries":[';

      jsonParseErrorHandler(error, {} as never, res as never, vi.fn() as never);
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "malformed JSON",
    });
  });
});
