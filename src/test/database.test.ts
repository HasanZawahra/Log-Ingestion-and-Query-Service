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

  it("retries initialization after an initial failure", async () => {
    mockConnect.mockRejectedValueOnce(new Error("db unavailable")).mockResolvedValueOnce({
      query: mockQuery,
      release: vi.fn(),
    });

    mockQuery.mockResolvedValue({ rows: [{ table_name: "logs" }] });

    const { initializeDatabase } = await import("../config/database.js");

    await expect(initializeDatabase()).rejects.toThrow("db unavailable");
    await expect(initializeDatabase()).resolves.toBeUndefined();
  });
});
