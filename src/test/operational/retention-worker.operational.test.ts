import { describe, expect, it, vi } from "vitest";
import { RetentionService } from "../../services/implementations/retention-service.js";
import { RetentionWorker } from "../../retention/retention-worker.js";
import type { IRetentionRepository } from "../../repositories/interfaces/retention-repository.js";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe("retention operational flow", () => {
  it("runs a real cleanup cycle and prevents concurrent execution", async () => {
    const deferred = createDeferred<number>();
    const repository: IRetentionRepository = {
      deleteExpiredLogs: vi.fn().mockReturnValueOnce(deferred.promise).mockResolvedValue(0),
    };
    const service = new RetentionService(repository, {
      logRetentionDays: 30,
      retentionIntervalMinutes: 60,
      retentionDeleteBatchSize: 1,
    });
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const worker = new RetentionWorker(
      service,
      {
        logRetentionDays: 30,
        retentionIntervalMinutes: 60,
        retentionDeleteBatchSize: 1,
      },
      logger
    );

    const firstRun = worker.executeCycle(new Date("2026-08-08T00:00:00.000Z"));
    await Promise.resolve();

    await worker.executeCycle(new Date("2026-08-08T01:00:00.000Z"));
    expect(repository.deleteExpiredLogs).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "Retention run skipped because a previous execution is still running"
    );

    deferred.resolve(0);
    await firstRun;

    await worker.executeCycle(new Date("2026-08-08T02:00:00.000Z"));
    expect(repository.deleteExpiredLogs).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      "Retention run completed",
      expect.objectContaining({
        deleted: 0,
        batches: 1,
      })
    );
  });
});
