import { calculateRetentionCutoff, getRetentionConfig } from "../../config/retention.js";
import type { IRetentionRepository } from "../../repositories/interfaces/retention-repository.js";
import type { IRetentionService, RetentionExecutionResult } from "../interfaces/retention-service.js";
import type { RetentionConfig } from "../../config/retention.js";

export class RetentionService implements IRetentionService {
  constructor(
    private readonly retentionRepository: IRetentionRepository,
    private readonly retentionConfig: RetentionConfig = getRetentionConfig()
  ) {}

  async runRetention(now: Date = new Date()): Promise<RetentionExecutionResult> {
    const { logRetentionDays, retentionDeleteBatchSize } = this.retentionConfig;
    const cutoff = calculateRetentionCutoff(now, logRetentionDays);

    let deleted = 0;
    let batches = 0;

    while (true) {
      const batchDeleted = await this.retentionRepository.deleteExpiredLogs(
        cutoff,
        retentionDeleteBatchSize
      );

      batches += 1;
      deleted += batchDeleted;

      if (batchDeleted < retentionDeleteBatchSize) {
        break;
      }
    }

    return {
      cutoff: cutoff.toISOString(),
      deleted,
      batches,
    };
  }
}
