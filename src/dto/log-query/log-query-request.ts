import { IngestLogLevel } from "../ingest/ingest-request.js";

export interface LogQueryRequest {
  service?: string;
  level?: IngestLogLevel;
  since?: string;
  until?: string;
  q?: string;
  limit?: number;
  cursor?: string;
  attributeFilters?: Record<string, string>;
}
