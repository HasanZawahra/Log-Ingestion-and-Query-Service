export interface ILogRepository {
  ensureSchemaReady(): Promise<void>;
}
