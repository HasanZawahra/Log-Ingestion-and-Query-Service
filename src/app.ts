import express from "express";
import { HealthController } from "./controllers/health-controller.js";
import { HealthService } from "./services/implementations/health-service.js";

export const app = express();

app.use(express.json());

const healthService = new HealthService();
const healthController = new HealthController(healthService);

app.get("/health", (req, res) => healthController.getHealth(req, res));
