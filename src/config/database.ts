import "dotenv/config";
import { Pool } from "pg";
import {
  DATABASE_URL_ENV_VAR,
  LOGS_TABLE_EXISTENCE_QUERY,
  MAX_DATABASE_CONNECTIONS,
} from "../constants/database.js";
import { MissingDatabaseUrlError } from "../errors/missing-database-url-error.js";
import { MissingLogsTableError } from "../errors/missing-logs-table-error.js";

const connectionString = process.env[DATABASE_URL_ENV_VAR]!;

if (!connectionString) {
  throw new MissingDatabaseUrlError();
}

export const pool = new Pool({
  connectionString,
  max: MAX_DATABASE_CONNECTIONS,
});

type InitializationState = "idle" | "initializing" | "ready" | "failed";

let initializationPromise: Promise<void> | null = null;
let initializationState: InitializationState = "idle";
let initializationError: Error | null = null;

export async function initializeDatabase(): Promise<void> {
  if (initializationState === "ready") {
    return;
  }

  if (initializationState === "initializing" && initializationPromise) {
    await initializationPromise;
    return;
  }

  initializationState = "initializing";
  initializationError = null;

  initializationPromise = (async () => {
    try {
      const client = await pool.connect();

      try {
        await client.query("SELECT 1");
        const { rows } = await client.query(LOGS_TABLE_EXISTENCE_QUERY);

        const tableExists = rows[0]?.table_name === "logs";

        if (!tableExists) {
          throw new MissingLogsTableError();
        }
      } finally {
        client.release();
      }

      initializationState = "ready";
    } catch (error) {
      initializationState = "failed";
      initializationError = error instanceof Error ? error : new Error(String(error));
      throw initializationError;
    }
  })();

  try {
    await initializationPromise;
  } catch (error) {
    initializationPromise = null;
    throw error;
  }
}

export async function getDatabaseHealth(): Promise<boolean> {
  try {
    await initializeDatabase();
    return initializationState === "ready";
  } catch {
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
