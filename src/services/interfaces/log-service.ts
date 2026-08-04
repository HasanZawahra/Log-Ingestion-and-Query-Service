import type { IngestRequest } from "../../dto/ingest/ingest-request.js";
import type { IngestResponse } from "../../dto/ingest/ingest-response.js";

export interface ILogService {
  ingestLogs(request: IngestRequest): Promise<IngestResponse>;
}
