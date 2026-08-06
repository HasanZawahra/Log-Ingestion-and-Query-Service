import { IngestLogLevel } from "../ingest/ingest-request.js";

export interface LogQueryEntry {
  id: number;
  timestamp: string;
  level: IngestLogLevel;
  service: string;
  message: string;
  attributes: Record<string, unknown>;
}

export interface LogQueryResponse {
  entries: LogQueryEntry[];
  next_cursor: string | null;
}
