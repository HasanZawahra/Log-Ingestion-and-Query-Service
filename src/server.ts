import { app } from "./app.js";
import { getLogRepository } from "./app.js";
import { DEFAULT_PORT } from "./constants/app.js";
import { getRetentionConfig } from "./config/retention.js";
import { initializeDatabase } from "./config/database.js";
import { closeDatabase } from "./config/database.js";
import { PostgresRetentionRepository } from "./repositories/postgres/retention-repository.js";
import { RetentionService } from "./services/implementations/retention-service.js";
import { RetentionWorker } from "./retention/retention-worker.js";

export function getPort(): number {
  // Honor an explicit port override when one is provided.
  const portValue = process.env.PORT!;
  const parsed = Number(portValue);

  // Fall back to the contractually required default port.
  return Number.isNaN(parsed) ? DEFAULT_PORT : parsed;
}

export async function startServer() {
  // Block startup until the database connection and schema are ready.
  await initializeDatabase();
  // Retention runs in the background once startup is complete.
  const retentionConfig = getRetentionConfig();
  const retentionService = new RetentionService(new PostgresRetentionRepository(), retentionConfig);
  const retentionWorker = new RetentionWorker(retentionService, retentionConfig);
  retentionWorker.start();

  // Start the HTTP listener after the app is ready.
  const port = getPort();
  const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  const shutdown = async () => {
    // Stop the recurring cleanup loop before draining connections.
    retentionWorker.stop();
    // Wait for any queued ingest batches to be flushed to Postgres.
    await getLogRepository().closeIngestBatcher();
    await new Promise<void>((resolve, reject) => {
      // Close the HTTP server so no new requests are accepted.
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    // Release the database pools once the app is fully drained.
    await closeDatabase();
  };

  process.once("SIGINT", () => {
    // Gracefully shut down when the process is interrupted.
    void shutdown().catch((error) => {
      console.error("Failed to shut down server", error);
      process.exit(1);
    });
  });

  process.once("SIGTERM", () => {
    // Gracefully shut down when the container asks us to exit.
    void shutdown().catch((error) => {
      console.error("Failed to shut down server", error);
      process.exit(1);
    });
  });

  return server;
}

if (process.env.NODE_ENV !== "test") {
  // Start the service automatically outside the test environment.
  startServer().catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
}
