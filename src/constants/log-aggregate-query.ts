export const LOG_AGGREGATE_BUCKET_EXPRESSIONS = {
  "1m": "date_bin(interval '1 minute', timestamp, '1970-01-01 00:00:00+00'::timestamptz)",
  "5m": "date_bin(interval '5 minutes', timestamp, '1970-01-01 00:00:00+00'::timestamptz)",
  "1h": "date_bin(interval '1 hour', timestamp, '1970-01-01 00:00:00+00'::timestamptz)",
  "1d": "date_bin(interval '1 day', timestamp, '1970-01-01 00:00:00+00'::timestamptz)",
} as const;

export const LOG_AGGREGATE_GROUP_BY_EXPRESSION = {
  service: "service::text",
  level: "level::text",
} as const;

export const LOG_AGGREGATE_ORDER_BY = 'ORDER BY start ASC, "group" ASC NULLS FIRST';
