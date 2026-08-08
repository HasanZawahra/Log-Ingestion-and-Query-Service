import { app } from "./app.js";
import { DEFAULT_PORT } from "./constants/app.js";
import { getRetentionConfig } from "./config/retention.js";
import { initializeDatabase } from "./config/database.js";
import { closeDatabase } from "./config/database.js";
import { PostgresRetentionRepository } from "./repositories/postgres/retention-repository.js";
import { RetentionService } from "./services/implementations/retention-service.js";
import { RetentionWorker } from "./retention/retention-worker.js";

export function getPort(): number {
  const portValue = process.env.PORT!;
  const parsed = Number(portValue);

  return Number.isNaN(parsed) ? DEFAULT_PORT : parsed;
}

export async function startServer() {
  await initializeDatabase();
  const retentionConfig = getRetentionConfig();
  const retentionService = new RetentionService(new PostgresRetentionRepository(), retentionConfig);
  const retentionWorker = new RetentionWorker(retentionService, retentionConfig);
  retentionWorker.start();

  const port = getPort();
  const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  const shutdown = async () => {
    retentionWorker.stop();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await closeDatabase();
  };

  process.once("SIGINT", () => {
    void shutdown().catch((error) => {
      console.error("Failed to shut down server", error);
      process.exit(1);
    });
  });

  process.once("SIGTERM", () => {
    void shutdown().catch((error) => {
      console.error("Failed to shut down server", error);
      process.exit(1);
    });
  });

  return server;
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
}
