import { IngestLogLevel } from "../ingest/ingest-request.js";

export interface LogQueryRequest {
  // Exact service filter.
  service?: string;
  // Exact severity filter.
  level?: IngestLogLevel;
  // Inclusive start timestamp.
  since?: string;
  // Exclusive end timestamp.
  until?: string;
  // Case-insensitive substring search against message text.
  q?: string;
  // Page size requested by the caller.
  limit?: number;
  // Opaque pagination token.
  cursor?: string;
  // Equality filters on structured attributes.
  attributeFilters?: Record<string, string>;
}
