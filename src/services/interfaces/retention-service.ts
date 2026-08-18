export interface RetentionExecutionResult {
  // ISO timestamp used as the retention cutoff for the run.
  cutoff: string;
  // Total number of deleted rows.
  deleted: number;
  // Number of delete batches executed.
  batches: number;
}

export interface IRetentionService {
  // Runs one retention cycle and reports what it removed.
  runRetention(now?: Date): Promise<RetentionExecutionResult>;
}
