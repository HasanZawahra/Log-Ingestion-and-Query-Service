import type { IngestRequest } from "../../dto/ingest/ingest-request.js";
import type { IngestResponse } from "../../dto/ingest/ingest-response.js";
import type { LogAggregateResponse } from "../../dto/log-aggregate/log-aggregate-response.js";
import type { LogQueryResponse } from "../../dto/log-query/log-query-response.js";

export interface ILogService {
  // Validates and persists an ingest batch.
  ingestLogs(request: IngestRequest): Promise<IngestResponse>;
  // Validates and executes the log search request.
  queryLogs(request: unknown): Promise<LogQueryResponse>;
  // Validates and executes the aggregate query request.
  queryLogAggregates(request: unknown): Promise<LogAggregateResponse>;
}
