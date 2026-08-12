import { IngestLogEntry } from "./ingest-request.js";

export interface RejectedEntry {
  index: number;
  reason: string;
  entry?: IngestLogEntry;
}

export interface IngestResponse {
  accepted: number;
  rejected: RejectedEntry[];
}
