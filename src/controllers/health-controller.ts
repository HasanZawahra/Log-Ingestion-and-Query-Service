import type { Request, Response } from "express";
import { ServiceUnavailableError } from "../errors/database/service-unavailable-error.js";
import type { IHealthService } from "../services/interfaces/health-service.js";

export class HealthController {
  constructor(private readonly healthService: IHealthService) {}

  async getHealth(_req: Request, res: Response): Promise<Response> {
    // Delegate readiness checks to the health service.
    const isHealthy = await this.healthService.checkHealth();

    if (!isHealthy) {
      // Signal to orchestration layers that the app is not ready yet.
      throw new ServiceUnavailableError();
    }

    // A healthy service returns a small JSON payload.
    return res.status(200).json({ status: "ok" });
  }
}
