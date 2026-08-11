export const DATABASE_URL_ENV_VAR = "DATABASE_URL";
export const LOGS_TABLE_NAME = "logs";
export const PUBLIC_LOGS_TABLE_NAME = "public.logs";
export const LOGS_TABLE_EXISTENCE_QUERY = "SELECT to_regclass('public.logs') AS table_name";
export const DATABASE_MIGRATIONS_FOLDER = "./src/database/migrations";
export const MAX_DATABASE_CONNECTIONS = 4;
