import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RetentionWorker } from "../../retention/retention-worker.js";
import type { IRetentionService } from "../../services/interfaces/retention-service.js";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("RetentionWorker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-08T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules cleanup after the configured interval and logs success", async () => {
    const runRetention = vi.fn().mockResolvedValue({
      cutoff: "2026-07-09T00:00:00.000Z",
      deleted: 128,
      batches: 1,
    });
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const service: IRetentionService = { runRetention };
    const worker = new RetentionWorker(
      service,
      {
        logRetentionDays: 30,
        retentionIntervalMinutes: 1,
        retentionDeleteBatchSize: 5000,
      },
      logger
    );

    worker.start();
    await vi.advanceTimersByTimeAsync(59_000);
    expect(runRetention).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(runRetention).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith("Retention run completed", {
      cutoff: "2026-07-09T00:00:00.000Z",
      deleted: 128,
      batches: 1,
    });
  });

  it("prevents overlapping executions", async () => {
    const deferred = createDeferred<void>();
    const runRetention = vi.fn().mockReturnValueOnce(deferred.promise).mockResolvedValue({
      cutoff: "2026-07-09T00:00:00.000Z",
      deleted: 0,
      batches: 1,
    });
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const service: IRetentionService = { runRetention };
    const worker = new RetentionWorker(
      service,
      {
        logRetentionDays: 30,
        retentionIntervalMinutes: 1,
        retentionDeleteBatchSize: 5000,
      },
      logger
    );

    worker.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runRetention).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(runRetention).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "Retention run skipped because a previous execution is still running"
    );

    deferred.resolve();
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(runRetention).toHaveBeenCalledTimes(2);
  });

  it("stops the timer and logs failures without crashing", async () => {
    const runRetention = vi.fn().mockRejectedValue(new Error("database unavailable"));
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const service: IRetentionService = { runRetention };
    const worker = new RetentionWorker(
      service,
      {
        logRetentionDays: 30,
        retentionIntervalMinutes: 1,
        retentionDeleteBatchSize: 5000,
      },
      logger
    );

    worker.start();
    worker.stop();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(runRetention).not.toHaveBeenCalled();

    await worker.executeCycle();
    expect(logger.error).toHaveBeenCalledWith("Retention run failed", {
      error: "database unavailable",
    });
  });
});
