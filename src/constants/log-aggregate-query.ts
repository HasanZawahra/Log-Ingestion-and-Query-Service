export const LOG_AGGREGATE_BUCKET_EXPRESSIONS = {
  "1m": "to_timestamp(floor(extract(epoch from timestamp) / 60) * 60)",
  "5m": "to_timestamp(floor(extract(epoch from timestamp) / 300) * 300)",
  "1h": "to_timestamp(floor(extract(epoch from timestamp) / 3600) * 3600)",
  "1d": "to_timestamp(floor(extract(epoch from timestamp) / 86400) * 86400)",
} as const;

export const LOG_AGGREGATE_GROUP_BY_EXPRESSION = {
  service: "service::text",
  level: "level::text",
} as const;

export const LOG_AGGREGATE_ORDER_BY = 'ORDER BY start ASC, "group" ASC NULLS FIRST';
