import { getDatabaseHealth } from "../../config/database.js";
import type { IHealthService } from "../interfaces/health-service.js";

export class HealthService implements IHealthService {
  async checkHealth(): Promise<boolean> {
    // Database readiness is the only health signal the API needs.
    return getDatabaseHealth();
  }
}
