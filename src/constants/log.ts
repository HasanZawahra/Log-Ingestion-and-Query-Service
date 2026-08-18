// The API accepts only the four log severities defined by the spec.
export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
// Each log insert writes timestamp, level, service, message, and attributes.
export const LOG_INSERT_FIELD_COUNT = 5;
// Large enough to reduce round trips without creating oversized statements.
export const MAX_LOGS_PER_INSERT = 4000;
// Query limits are clamped to a minimum of one result.
export const MIN_LOG_QUERY_LIMIT = 1;
// The default page size matches the API contract.
export const DEFAULT_LOG_QUERY_LIMIT = 100;
// The API caps query pages to keep response sizes predictable.
export const MAX_LOG_QUERY_LIMIT = 1000;
// Cursors are encoded with base64url so they are safe in query strings.
export const LOG_QUERY_CURSOR_ENCODING = "base64url";
