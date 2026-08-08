import type { RetentionConfig } from "../config/retention.js";
import { RETENTION_RUNS_ON_STARTUP } from "../constants/retention.js";
import type {
  IRetentionService,
  RetentionExecutionResult,
} from "../services/interfaces/retention-service.js";

export interface RetentionWorkerLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export class RetentionWorker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly retentionService: IRetentionService,
    private readonly retentionConfig: RetentionConfig,
    private readonly logger: RetentionWorkerLogger = console
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    const intervalMs = this.retentionConfig.retentionIntervalMinutes * 60 * 1000;

    if (RETENTION_RUNS_ON_STARTUP) {
      void this.executeCycle();
    }

    this.timer = setInterval(() => {
      void this.executeCycle();
    }, intervalMs);

    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  async executeCycle(now: Date = new Date()): Promise<void> {
    if (this.running) {
      this.logger.warn("Retention run skipped because a previous execution is still running");
      return;
    }

    this.running = true;

    try {
      const result = await this.retentionService.runRetention(now);
      this.logSuccess(result);
    } catch (error) {
      this.logger.error("Retention run failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running = false;
    }
  }

  private logSuccess(result: RetentionExecutionResult): void {
    this.logger.info("Retention run completed", {
      cutoff: result.cutoff,
      deleted: result.deleted,
      batches: result.batches,
    });
  }
}
