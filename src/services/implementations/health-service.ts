import { getDatabaseHealth } from "../../config/database.js";
import type { IHealthService } from "../interfaces/health-service.js";

export class HealthService implements IHealthService {
  async checkHealth(): Promise<boolean> {
    return getDatabaseHealth();
  }
}
