import type { IngestRequest } from "../../dto/ingest/ingest-request.js";
import type { IngestResponse } from "../../dto/ingest/ingest-response.js";
import type { LogQueryResponse } from "../../dto/log-query/log-query-response.js";
import { AllEntriesRejectedError } from "../../errors/logs/all-entries-rejected-error.js";
import { InvalidLogQueryError } from "../../errors/logs/invalid-log-query-error.js";
import { parseLogQueryRequest } from "../../validation/log-query-validator.js";
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

    const response = {
      accepted: validEntries.length,
      rejected: rejectedEntries.length,
      rejectedEntries,
    };

    if (response.accepted === 0) {
      throw new AllEntriesRejectedError(response);
    }

    return response;
  }

  async queryLogs(request: unknown): Promise<LogQueryResponse> {
    const validation = parseLogQueryRequest(request);

    if (validation.errors.length > 0 || !validation.value) {
      throw new InvalidLogQueryError(validation.errors);
    }

    return this.logRepository.queryLogs(validation.value);
  }
}
