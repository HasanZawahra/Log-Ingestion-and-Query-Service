import type { IngestLogLevel } from "../ingest/ingest-request.js";

// Supported bucket sizes for aggregation requests.
export type LogAggregateBucket = "1m" | "5m" | "1h" | "1d";
// Supported grouping dimensions for aggregate results.
export type LogAggregateGroupBy = "service" | "level";

export interface LogAggregateRequest {
  // Inclusive lower bound for the aggregation window.
  since: string;
  // Exclusive upper bound for the aggregation window.
  until: string;
  // Required bucket size.
  bucket: LogAggregateBucket;
  // Optional dimension to split each bucket into.
  groupBy?: LogAggregateGroupBy;
  // Optional exact service filter.
  service?: string;
  // Optional exact severity filter.
  level?: IngestLogLevel;
  // Optional substring search on the message body.
  q?: string;
  // Optional attribute equality filters.
  attributeFilters?: Record<string, string>;
}
