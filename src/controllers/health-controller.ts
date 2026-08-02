import type { Request, Response } from "express";
import type { IHealthService } from "../services/interfaces/health-service.js";

export class HealthController {
  constructor(private readonly healthService: IHealthService) {}

  async getHealth(_req: Request, res: Response): Promise<Response> {
    const isHealthy = await this.healthService.checkHealth();

    if (!isHealthy) {
      return res.status(503).json({ status: "unavailable" });
    }

    return res.status(200).json({ status: "ok" });
  }
}
