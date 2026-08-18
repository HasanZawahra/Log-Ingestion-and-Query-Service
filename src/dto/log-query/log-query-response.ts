import { IngestLogLevel } from "../ingest/ingest-request.js";

export interface LogQueryEntry {
  // Stable stringified id used for cursor pagination.
  id: string;
  // UTC timestamp serialized as an ISO 8601 string.
  timestamp: string;
  // Log severity level.
  level: IngestLogLevel;
  // Source service that emitted the log.
  service: string;
  // Log message payload.
  message: string;
  // Structured metadata attached at ingest time.
  attributes: Record<string, unknown>;
}

export interface LogQueryResponse {
  // Ordered page of matching logs.
  logs: LogQueryEntry[];
  // Cursor for the next page, or null if the result set is exhausted.
  next_cursor: string | null;
}
