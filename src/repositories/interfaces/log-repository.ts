import type { IngestLogEntry } from "../../dto/ingest/ingest-request.js";
import type { LogQueryRequest } from "../../dto/log-query/log-query-request.js";
import type { LogQueryResponse } from "../../dto/log-query/log-query-response.js";

export interface ILogRepository {
  ensureSchemaReady(): Promise<void>;
  saveLogs(entries: IngestLogEntry[]): Promise<void>;
  queryLogs(request: LogQueryRequest): Promise<LogQueryResponse>;
}
