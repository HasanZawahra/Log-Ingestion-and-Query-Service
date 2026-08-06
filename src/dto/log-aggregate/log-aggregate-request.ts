import type { IngestLogLevel } from "../ingest/ingest-request.js";

export type LogAggregateBucket = "1m" | "5m" | "1h" | "1d";
export type LogAggregateGroupBy = "service" | "level";

export interface LogAggregateRequest {
  since: string;
  until: string;
  bucket: LogAggregateBucket;
  groupBy?: LogAggregateGroupBy;
  service?: string;
  level?: IngestLogLevel;
  q?: string;
  attributeFilters?: Record<string, string>;
}
