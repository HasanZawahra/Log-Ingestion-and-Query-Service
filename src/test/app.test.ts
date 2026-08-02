import { describe, expect, it, vi } from "vitest";
import { HealthController } from "../controllers/health-controller.js";
import type { IHealthService } from "../services/interfaces/health-service.js";

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
