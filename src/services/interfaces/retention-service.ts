export interface RetentionExecutionResult {
  cutoff: string;
  deleted: number;
  batches: number;
}

export interface IRetentionService {
  runRetention(now?: Date): Promise<RetentionExecutionResult>;
}
