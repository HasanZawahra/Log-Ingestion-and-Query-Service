import express from "express";
import { HealthController } from "./controllers/health-controller.js";
import { LogController } from "./controllers/log-controller.js";
import { HEALTH_ROUTE, LOGS_AGGREGATE_ROUTE, LOGS_ROUTE } from "./constants/routes.js";
import { PostgresLogRepository } from "./repositories/postgres/log-repository.js";
import { PostgresLogQueryBuilder } from "./repositories/postgres/builders/log-query-builder.js";
import { HealthService } from "./services/implementations/health-service.js";
import { LogService } from "./services/implementations/log-service.js";
import { applicationErrorHandler, jsonParseErrorHandler } from "./utils/middleware.js";

export const app = express();

app.use(express.json({ limit: "20mb" }));

const healthService = new HealthService();
const healthController = new HealthController(healthService);
const logQueryBuilder = new PostgresLogQueryBuilder();
const logRepository = new PostgresLogRepository(logQueryBuilder);
const logService = new LogService(logRepository);
const logController = new LogController(logService);

app.get(HEALTH_ROUTE, (req, res) => healthController.getHealth(req, res));
app.get(LOGS_ROUTE, (req, res) => logController.queryLogs(req, res));
app.get(LOGS_AGGREGATE_ROUTE, (req, res) => logController.queryLogAggregates(req, res));
app.post(LOGS_ROUTE, (req, res) => logController.ingestLogs(req, res));

app.use(jsonParseErrorHandler);
app.use(applicationErrorHandler);
