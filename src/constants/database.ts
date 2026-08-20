// The PostgreSQL connection string must be available at runtime.
export const DATABASE_URL_ENV_VAR = "DATABASE_URL";
// Canonical table name for the raw log table.
export const LOGS_TABLE_NAME = "logs";
// Canonical table name for the minute-level aggregate table.
export const LOG_MINUTE_AGGREGATES_TABLE_NAME = "log_minute_aggregates";
// Fully qualified raw-log table name for SQL builders.
export const PUBLIC_LOGS_TABLE_NAME = "public.logs";
// Fully qualified aggregate table name for SQL builders.
export const PUBLIC_LOG_MINUTE_AGGREGATES_TABLE_NAME = "public.log_minute_aggregates";
// Health checks verify that the logs table exists before serving traffic.
export const LOGS_TABLE_EXISTENCE_QUERY = "SELECT to_regclass('public.logs') AS table_name";
// Drizzle migrations live in this repository folder.
export const DATABASE_MIGRATIONS_FOLDER = "./src/database/migrations";
// The connection cap is shared across the main database pool.
export const MAX_DATABASE_CONNECTIONS = 20;
