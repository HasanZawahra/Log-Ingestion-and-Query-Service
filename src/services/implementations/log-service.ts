import type { IngestRequest } from "../../dto/ingest-request.js";
import type { IngestResponse } from "../../dto/ingest-response.js";
import { validateBatch } from "../../validation/log-validator.js";
import type { ILogService } from "../interfaces/log-service.js";
import type { ILogRepository } from "../../repositories/interfaces/log-repository.js";

export class LogService implements ILogService {
  constructor(private readonly logRepository: ILogRepository) {}

  async ingestLogs(request: IngestRequest): Promise<IngestResponse> {
    const { validEntries, rejectedEntries } = validateBatch(request);

    if (validEntries.length > 0) {
      await this.logRepository.saveLogs(validEntries);
    }

    return {
      accepted: validEntries.length,
      rejected: rejectedEntries.length,
      rejectedEntries,
    };
  }
}
