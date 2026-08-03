import type { IngestRequest } from "../../dto/ingest-request.js";
import type { IngestResponse } from "../../dto/ingest-response.js";

export interface ILogService {
  ingestLogs(request: IngestRequest): Promise<IngestResponse>;
}
