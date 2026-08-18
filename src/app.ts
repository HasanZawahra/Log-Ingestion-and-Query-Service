import express from "express";
import { HealthController } from "./controllers/health-controller.js";
import { LogController } from "./controllers/log-controller.js";
import { HEALTH_ROUTE, LOGS_AGGREGATE_ROUTE, LOGS_ROUTE } from "./constants/routes.js";
import { PostgresLogRepository } from "./repositories/postgres/log-repository.js";
import { PostgresLogQueryBuilder } from "./repositories/postgres/builders/log-query-builder.js";
import { HealthService } from "./services/implementations/health-service.js";
import { LogService } from "./services/implementations/log-service.js";
import { applicationErrorHandler, jsonParseErrorHandler } from "./utils/middleware.js";

// The Express instance is created once and shared across the app.
export const app = express();

// Parse JSON bodies up to a generous limit for large ingest batches.
app.use(express.json({ limit: "20mb" }));

// Build the dependency graph once so handlers can share the same services.
const healthService = new HealthService();
const healthController = new HealthController(healthService);
const logQueryBuilder = new PostgresLogQueryBuilder();
const logRepository = new PostgresLogRepository(logQueryBuilder);
const logService = new LogService(logRepository);
const logController = new LogController(logService);

// Export the repository for shutdown hooks and tests that need direct access.
export { logRepository };

// Keep the repository accessor small and explicit for the shutdown path.
export function getLogRepository(): PostgresLogRepository {
  return logRepository;
}

// Wire the contractually required routes to their controller methods.
app.get(HEALTH_ROUTE, (req, res) => healthController.getHealth(req, res));
app.get(LOGS_ROUTE, (req, res) => logController.queryLogs(req, res));
app.get(LOGS_AGGREGATE_ROUTE, (req, res) => logController.queryLogAggregates(req, res));
app.post(LOGS_ROUTE, (req, res) => logController.ingestLogs(req, res));

// Convert parser errors and application errors into API responses.
app.use(jsonParseErrorHandler);
app.use(applicationErrorHandler);
