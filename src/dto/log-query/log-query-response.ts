import { IngestLogLevel } from "../ingest/ingest-request.js";

export interface LogQueryEntry {
  id: string;
  timestamp: string;
  level: IngestLogLevel;
  service: string;
  message: string;
  attributes: Record<string, unknown>;
}

export interface LogQueryResponse {
  logs: LogQueryEntry[];
  next_cursor: string | null;
}
