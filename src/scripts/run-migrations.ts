import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import "dotenv/config";
import {
  DATABASE_MIGRATIONS_FOLDER,
  DATABASE_URL_ENV_VAR,
  MAX_DATABASE_CONNECTIONS,
} from "../constants/database.js";
import { MissingDatabaseUrlError } from "../errors/database/missing-database-url-error.js";

// The migration script needs a database URL just like the main server.
const connectionString = process.env[DATABASE_URL_ENV_VAR];

if (!connectionString) {
  throw new MissingDatabaseUrlError();
}

// Use the same connection limit as the application runtime.
const sql = postgres(connectionString, { max: MAX_DATABASE_CONNECTIONS });
// Wrap the postgres client with Drizzle so migrations can run cleanly.
const db = drizzle(sql);

// Apply all pending schema migrations from the repository folder.
await migrate(db, { migrationsFolder: DATABASE_MIGRATIONS_FOLDER });
// Close the migration connection once the schema is up to date.
await sql.end();
