import "dotenv/config";
import { Pool } from "pg";
import {
  DATABASE_URL_ENV_VAR,
  LOGS_TABLE_EXISTENCE_QUERY,
  MAX_DATABASE_CONNECTIONS,
} from "../constants/database.js";
import { MissingDatabaseUrlError } from "../errors/database/missing-database-url-error.js";
import { MissingLogsTableError } from "../errors/database/missing-logs-table-error.js";

// Fail fast if the service starts without a database URL.
const connectionString = process.env[DATABASE_URL_ENV_VAR]!;

if (!connectionString) {
  throw new MissingDatabaseUrlError();
}

// A single shared pool backs database initialization and health checks.
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
    // A previous call already confirmed readiness.
    return;
  }

  if (initializationState === "initializing" && initializationPromise) {
    // Concurrent callers wait on the in-flight initialization work.
    await initializationPromise;
    return;
  }

  // Move into the initializing state before any I/O begins.
  initializationState = "initializing";
  initializationError = null;

  initializationPromise = (async () => {
    try {
      // Acquire a connection and verify the database responds.
      const client = await pool.connect();

      try {
        await client.query("SELECT 1");
        const { rows } = await client.query(LOGS_TABLE_EXISTENCE_QUERY);

        // Health is only true once the raw logs table exists.
        const tableExists = rows[0]?.table_name === "logs";

        if (!tableExists) {
          throw new MissingLogsTableError();
        }
      } finally {
        // Release the probe connection no matter what happened above.
        client.release();
      }

      // Mark the database as ready only after all checks pass.
      initializationState = "ready";
    } catch (error) {
      // Persist the failure reason for debugging and test assertions.
      initializationState = "failed";
      initializationError = error instanceof Error ? error : new Error(String(error));
      throw initializationError;
    }
  })();

  try {
    await initializationPromise;
  } catch (error) {
    // Clear the promise so a later retry can run again from scratch.
    initializationPromise = null;
    throw error;
  }
}

export async function getDatabaseHealth(): Promise<boolean> {
  try {
    // If initialization succeeds, readiness depends on the recorded state.
    await initializeDatabase();
    return initializationState === "ready";
  } catch {
    // Any initialization failure means the app is not healthy yet.
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  // Shut down the shared pool during process exit.
  await pool.end();
}
