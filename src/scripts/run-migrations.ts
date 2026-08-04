import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import "dotenv/config";
import { MissingDatabaseUrlError } from "../errors/missing-database-url-error.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new MissingDatabaseUrlError();
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder: "./src/database/migrations" });
await sql.end();
