import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConnect = vi.fn();
const mockQuery = vi.fn();

vi.mock("pg", () => ({
  Pool: vi.fn(function (this: { connect: typeof mockConnect; end: () => void }) {
    this.connect = mockConnect;
    this.end = vi.fn();
  }),
}));

describe("database initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    mockConnect.mockReset();
    mockQuery.mockReset();
  });

  it("throws a typed error when DATABASE_URL is missing", async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "";

    try {
      await expect(import("../../config/database.js")).rejects.toMatchObject({
        name: "MissingDatabaseUrlError",
        message: "DATABASE_URL must be set",
      });
    } finally {
      if (originalDatabaseUrl !== undefined) {
        process.env.DATABASE_URL = originalDatabaseUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
    }
  });

  it("retries initialization after an initial failure", async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/app";

    mockConnect.mockRejectedValueOnce(new Error("db unavailable")).mockResolvedValueOnce({
      query: mockQuery,
      release: vi.fn(),
    });

    mockQuery.mockResolvedValue({ rows: [{ table_name: "logs" }] });

    try {
      const { initializeDatabase } = await import("../../config/database.js");

      await expect(initializeDatabase()).rejects.toThrow("db unavailable");
      await expect(initializeDatabase()).resolves.toBeUndefined();
    } finally {
      if (originalDatabaseUrl !== undefined) {
        process.env.DATABASE_URL = originalDatabaseUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
    }
  });
});
