import "dotenv/config";
import { Pool } from "pg";
import { PostgresLogRepository } from "../repositories/postgres/log-repository.js";

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set");
}

export const pool = new Pool({
  connectionString,
});

const logRepository = new PostgresLogRepository();

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
      } finally {
        client.release();
      }

      await logRepository.ensureSchemaReady();
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
