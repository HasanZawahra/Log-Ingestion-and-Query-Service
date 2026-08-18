import type { IngestLogEntry } from "../../dto/ingest/ingest-request.js";
import type { LogAggregateRequest } from "../../dto/log-aggregate/log-aggregate-request.js";
import type { LogAggregateResponse } from "../../dto/log-aggregate/log-aggregate-response.js";
import type { LogQueryRequest } from "../../dto/log-query/log-query-request.js";
import type { LogQueryResponse } from "../../dto/log-query/log-query-response.js";

export interface ILogRepository {
  // Confirm the logs schema is present before serving traffic.
  ensureSchemaReady(): Promise<void>;
  // Persist validated ingest entries.
  saveLogs(entries: IngestLogEntry[]): Promise<void>;
  // Flush any queued ingest work to Postgres.
  flushPendingLogs(): Promise<void>;
  // Execute the raw log search query.
  queryLogs(request: LogQueryRequest): Promise<LogQueryResponse>;
  // Execute the aggregate query.
  queryLogAggregates(request: LogAggregateRequest): Promise<LogAggregateResponse>;
}
