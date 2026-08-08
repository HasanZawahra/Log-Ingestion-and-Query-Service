import { beforeEach, describe, expect, it, vi } from "vitest";
import { RetentionService } from "../../services/implementations/retention-service.js";
import type { IRetentionRepository } from "../../repositories/interfaces/retention-repository.js";

const originalEnv = { ...process.env };

describe("RetentionService", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("returns immediately when there are no expired logs", async () => {
    process.env.LOG_RETENTION_DAYS = "30";
    process.env.RETENTION_DELETE_BATCH_SIZE = "5000";
    const deleteExpiredLogs = vi.fn().mockResolvedValue(0);
    const repository: IRetentionRepository = {
      deleteExpiredLogs,
    };

    const service = new RetentionService(repository);
    const result = await service.runRetention(new Date("2026-08-08T00:00:00.000Z"));

    expect(deleteExpiredLogs).toHaveBeenCalledTimes(1);
    expect(deleteExpiredLogs).toHaveBeenCalledWith(new Date("2026-07-09T00:00:00.000Z"), 5000);
    expect(result).toEqual({
      cutoff: "2026-07-09T00:00:00.000Z",
      deleted: 0,
      batches: 1,
    });
  });

  it("deletes one batch and stops when the batch is not full", async () => {
    process.env.LOG_RETENTION_DAYS = "30";
    process.env.RETENTION_DELETE_BATCH_SIZE = "5000";
    const deleteExpiredLogs = vi.fn().mockResolvedValue(128);
    const repository: IRetentionRepository = {
      deleteExpiredLogs,
    };

    const service = new RetentionService(repository);
    const result = await service.runRetention(new Date("2026-08-08T00:00:00.000Z"));

    expect(deleteExpiredLogs).toHaveBeenCalledTimes(1);
    expect(result.deleted).toBe(128);
    expect(result.batches).toBe(1);
  });

  it("continues deleting multiple batches until the final batch is smaller", async () => {
    process.env.LOG_RETENTION_DAYS = "30";
    process.env.RETENTION_DELETE_BATCH_SIZE = "5000";
    const deleteExpiredLogs = vi
      .fn()
      .mockResolvedValueOnce(5000)
      .mockResolvedValueOnce(5000)
      .mockResolvedValueOnce(74);
    const repository: IRetentionRepository = {
      deleteExpiredLogs,
    };

    const service = new RetentionService(repository);
    const result = await service.runRetention(new Date("2026-08-08T00:00:00.000Z"));

    expect(deleteExpiredLogs).toHaveBeenCalledTimes(3);
    expect(result.deleted).toBe(10074);
    expect(result.batches).toBe(3);
  });

  it("propagates repository failures", async () => {
    process.env.LOG_RETENTION_DAYS = "30";
    process.env.RETENTION_DELETE_BATCH_SIZE = "5000";
    const deleteExpiredLogs = vi.fn().mockRejectedValue(new Error("database unavailable"));
    const repository: IRetentionRepository = {
      deleteExpiredLogs,
    };

    const service = new RetentionService(repository);

    await expect(service.runRetention(new Date("2026-08-08T00:00:00.000Z"))).rejects.toThrow(
      "database unavailable"
    );
    expect(deleteExpiredLogs).toHaveBeenCalledTimes(1);
  });
});
