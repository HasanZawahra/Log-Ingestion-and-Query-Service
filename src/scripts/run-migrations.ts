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

const connectionString = process.env[DATABASE_URL_ENV_VAR];

if (!connectionString) {
  throw new MissingDatabaseUrlError();
}

const sql = postgres(connectionString, { max: MAX_DATABASE_CONNECTIONS });
const db = drizzle(sql);

await migrate(db, { migrationsFolder: DATABASE_MIGRATIONS_FOLDER });
await sql.end();
