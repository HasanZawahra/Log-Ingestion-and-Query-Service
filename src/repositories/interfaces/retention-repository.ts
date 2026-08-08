export interface IRetentionRepository {
  deleteExpiredLogs(cutoff: Date, batchSize: number): Promise<number>;
}
