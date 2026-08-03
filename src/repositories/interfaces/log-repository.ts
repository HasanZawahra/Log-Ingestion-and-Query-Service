import type { IngestLogEntry } from "../../dto/ingest-request.js";

export interface ILogRepository {
  ensureSchemaReady(): Promise<void>;
  saveLogs(entries: IngestLogEntry[]): Promise<void>;
}
