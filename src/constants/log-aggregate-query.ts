export const LOG_AGGREGATE_BUCKET_EXPRESSIONS = {
  "1m": "date_trunc('minute', timestamp)",
  "5m": "to_timestamp(floor(extract(epoch from timestamp) / 300) * 300)",
  "1h": "date_trunc('hour', timestamp)",
  "1d": "date_trunc('day', timestamp)",
} as const;

export const LOG_AGGREGATE_GROUP_BY_EXPRESSION = {
  service: "service::text",
  level: "level::text",
} as const;

export const LOG_AGGREGATE_ORDER_BY = "ORDER BY 1 ASC, 2 ASC NULLS FIRST";
