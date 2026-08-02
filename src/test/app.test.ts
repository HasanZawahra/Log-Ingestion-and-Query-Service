import { describe, expect, it, vi } from "vitest";
import { app } from "../app.js";

vi.mock("../config/database.js", () => ({
  getDatabaseHealth: vi.fn(),
}));

import { getDatabaseHealth } from "../config/database.js";

const mockedGetDatabaseHealth = vi.mocked(getDatabaseHealth);

describe("GET /health", () => {
  it("returns ok when the database is healthy", async () => {
    mockedGetDatabaseHealth.mockResolvedValueOnce(true);

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

      app.handle(req as never, res as never);
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns unavailable when the database is not healthy", async () => {
    mockedGetDatabaseHealth.mockResolvedValueOnce(false);

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

      app.handle(req as never, res as never);
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "unavailable" });
  });
});
