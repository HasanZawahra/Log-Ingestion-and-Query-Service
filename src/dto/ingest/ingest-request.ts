export type IngestLogLevel = "debug" | "info" | "warn" | "error";

export interface IngestLogEntry {
  timestamp: string;
  level: IngestLogLevel;
  service: string;
  message: string;
  attributes?: Record<string, unknown>;
}

export interface IngestRequest {
  entries: IngestLogEntry[];
}
