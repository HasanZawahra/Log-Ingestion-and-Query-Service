import type { IngestRequest } from "../../dto/ingest/ingest-request.js";
import type { IngestResponse } from "../../dto/ingest/ingest-response.js";
import type { LogQueryResponse } from "../../dto/log-query/log-query-response.js";

export interface ILogService {
  ingestLogs(request: IngestRequest): Promise<IngestResponse>;
  queryLogs(request: unknown): Promise<LogQueryResponse>;
}
