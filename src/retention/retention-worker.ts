import type { RetentionConfig } from "../config/retention.js";
import { RETENTION_RUNS_ON_STARTUP } from "../constants/retention.js";
import type {
  IRetentionService,
  RetentionExecutionResult,
} from "../services/interfaces/retention-service.js";

export interface RetentionWorkerLogger {
  // Informational messages for successful retention runs.
  info(message: string, meta?: Record<string, unknown>): void;
  // Warnings for skipped or overlapping runs.
  warn(message: string, meta?: Record<string, unknown>): void;
  // Errors for failed retention executions.
  error(message: string, meta?: Record<string, unknown>): void;
}

export class RetentionWorker {
  // One timer drives the periodic cleanup loop.
  private timer: ReturnType<typeof setInterval> | null = null;
  // Prevent overlapping retention cycles.
  private running = false;

  constructor(
    private readonly retentionService: IRetentionService,
    private readonly retentionConfig: RetentionConfig,
    private readonly logger: RetentionWorkerLogger = console
  ) {}

  start(): void {
    if (this.timer) {
      // Starting twice is a no-op.
      return;
    }

    // Convert the configured interval into milliseconds.
    const intervalMs = this.retentionConfig.retentionIntervalMinutes * 60 * 1000;

    if (RETENTION_RUNS_ON_STARTUP) {
      // Optional startup run for environments that want immediate cleanup.
      void this.executeCycle();
    }

    // Schedule the recurring cleanup loop.
    this.timer = setInterval(() => {
      void this.executeCycle();
    }, intervalMs);

    // Let the process exit naturally when only the timer remains.
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) {
      // Nothing to stop if the worker was never started.
      return;
    }

    // Clear the interval and drop the reference.
    clearInterval(this.timer);
    this.timer = null;
  }

  async executeCycle(now: Date = new Date()): Promise<void> {
    if (this.running) {
      // Skip overlapping runs so deletes do not pile up.
      this.logger.warn("Retention run skipped because a previous execution is still running");
      return;
    }

    // Mark the worker busy before calling into the service.
    this.running = true;

    try {
      // Delegate the actual delete loop to the retention service.
      const result = await this.retentionService.runRetention(now);
      this.logSuccess(result);
    } catch (error) {
      // Log the failure but keep the worker alive for the next cycle.
      this.logger.error("Retention run failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // Always clear the busy flag so the next cycle can run.
      this.running = false;
    }
  }

  private logSuccess(result: RetentionExecutionResult): void {
    // Log a compact summary of the retention work that just completed.
    this.logger.info("Retention run completed", {
      cutoff: result.cutoff,
      deleted: result.deleted,
      batches: result.batches,
    });
  }
}
