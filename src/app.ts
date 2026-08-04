import express from "express";
import { HealthController } from "./controllers/health-controller.js";
import { LogController } from "./controllers/log-controller.js";
import { PostgresLogRepository } from "./repositories/postgres/log-repository.js";
import { HealthService } from "./services/implementations/health-service.js";
import { LogService } from "./services/implementations/log-service.js";
import { applicationErrorHandler, jsonParseErrorHandler } from "./utils/middleware.js";

export const app = express();

app.use(express.json());

const healthService = new HealthService();
const healthController = new HealthController(healthService);
const logRepository = new PostgresLogRepository();
const logService = new LogService(logRepository);
const logController = new LogController(logService);

app.get("/health", (req, res) => healthController.getHealth(req, res));
app.post("/logs", (req, res) => logController.ingestLogs(req, res));

app.use(jsonParseErrorHandler);
app.use(applicationErrorHandler);
