// Only the bucket sizes required by the contract are exposed.
export const LOG_AGGREGATE_BUCKETS = ["1m", "5m", "1h", "1d"] as const;
// Aggregates can group by service or severity level.
export const LOG_AGGREGATE_GROUP_BY_VALUES = ["service", "level"] as const;
