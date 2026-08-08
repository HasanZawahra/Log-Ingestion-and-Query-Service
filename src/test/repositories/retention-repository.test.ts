import { beforeEach, describe, expect, it, vi } from "vitest";
import { PostgresRetentionRepository } from "../../repositories/postgres/retention-repository.js";

const { mockConnect, mockQuery, mockRelease } = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockQuery: vi.fn(),
  mockRelease: vi.fn(),
}));

vi.mock("../../config/database.js", () => ({
  pool: {
    connect: mockConnect,
  },
}));

describe("PostgresRetentionRepository", () => {
  beforeEach(() => {
    mockConnect.mockReset();
    mockQuery.mockReset();
    mockRelease.mockReset();
  });

  it("deletes expired logs in a bounded parameterized batch", async () => {
    mockConnect.mockResolvedValue({
      query: mockQuery.mockResolvedValue({ rowCount: 128 }),
      release: mockRelease,
    });

    const repository = new PostgresRetentionRepository();
    const cutoff = new Date("2026-07-09T00:00:00.000Z");

    const deleted = await repository.deleteExpiredLogs(cutoff, 5000);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("WITH expired AS ("),
      [cutoff, 5000]
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE timestamp < $1"),
      [cutoff, 5000]
    );
    expect(deleted).toBe(128);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});
