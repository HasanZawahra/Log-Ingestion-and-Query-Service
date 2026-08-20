export interface IRetentionRepository {
  // Delete expired rows in bounded batches.
  deleteExpiredLogs(cutoff: Date, batchSize: number): Promise<number>;
}
