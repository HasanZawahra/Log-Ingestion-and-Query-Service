import type { Request, Response } from "express";
import { ServiceUnavailableError } from "../errors/service-unavailable-error.js";
import type { IHealthService } from "../services/interfaces/health-service.js";

export class HealthController {
  constructor(private readonly healthService: IHealthService) {}

  async getHealth(_req: Request, res: Response): Promise<Response> {
    const isHealthy = await this.healthService.checkHealth();

    if (!isHealthy) {
      throw new ServiceUnavailableError();
    }

    return res.status(200).json({ status: "ok" });
  }
}
