// Health check endpoint used by docker-compose and the load generator.
export const HEALTH_ROUTE = "/health";
// Primary ingestion and query endpoint for raw log entries.
export const LOGS_ROUTE = "/logs";
// Aggregation endpoint for time-bucketed rollups.
export const LOGS_AGGREGATE_ROUTE = "/logs/aggregate";
