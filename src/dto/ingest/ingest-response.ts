import { IngestLogEntry } from "./ingest-request.js";

export interface RejectedEntry {
  // Position of the rejected log inside the submitted batch.
  index: number;
  // Human-readable reason describing why validation failed.
  reason: string;
  // Echo the invalid entry so callers can inspect the failure.
  entry?: IngestLogEntry;
}

export interface IngestResponse {
  // Number of entries accepted from the batch.
  accepted: number;
  // Detailed rejection records for invalid entries.
  rejected: RejectedEntry[];
}
