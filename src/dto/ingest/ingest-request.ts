// The ingest API accepts the four contractually supported severities.
export type IngestLogLevel = "debug" | "info" | "warn" | "error";

export interface IngestLogEntry {
  // ISO 8601 timestamp supplied by the client.
  timestamp: string;
  // Severity bucket for the log line.
  level: IngestLogLevel;
  // Logical service name that emitted the log.
  service: string;
  // Human-readable log message.
  message: string;
  // Arbitrary structured metadata attached to the event.
  attributes?: Record<string, unknown>;
}

export interface IngestRequest {
  // Ingestion always happens in batches, even for a single log.
  entries: IngestLogEntry[];
}
