import type { IngestRequest } from "../../dto/ingest/ingest-request.js";
import type { IngestResponse } from "../../dto/ingest/ingest-response.js";
import type { LogAggregateResponse } from "../../dto/log-aggregate/log-aggregate-response.js";
import type { LogQueryResponse } from "../../dto/log-query/log-query-response.js";
import { AllEntriesRejectedError } from "../../errors/logs/all-entries-rejected-error.js";
import { InvalidLogAggregateError } from "../../errors/logs/invalid-log-aggregate-error.js";
import { InvalidLogQueryError } from "../../errors/logs/invalid-log-query-error.js";
import { parseLogAggregateRequest } from "../../validation/log-aggregate-validator.js";
import { parseLogQueryRequest } from "../../validation/log-query-validator.js";
import { validateBatch } from "../../validation/log-validator.js";
import type { ILogService } from "../interfaces/log-service.js";
import type { ILogRepository } from "../../repositories/interfaces/log-repository.js";

export class LogService implements ILogService {
  constructor(private readonly logRepository: ILogRepository) {}

  async ingestLogs(request: IngestRequest): Promise<IngestResponse> {
    // Split the batch into valid and rejected entries first.
    const { validEntries, rejectedEntries } = validateBatch(request);

    if (validEntries.length > 0) {
      // Persist only the entries that passed validation.
      await this.logRepository.saveLogs(validEntries);
    }

    // Build the API response up front so the rejection path can reuse it.
    const response = {
      accepted: validEntries.length,
      rejected: rejectedEntries,
    };

    if (response.accepted === 0) {
      // The contract requires a 400 when every entry is rejected.
      throw new AllEntriesRejectedError(response);
    }

    return response;
  }

  async queryLogs(request: unknown): Promise<LogQueryResponse> {
    // Normalize and validate the query parameters first.
    const validation = parseLogQueryRequest(request);

    if (validation.errors.length > 0 || !validation.value) {
      // Return a structured bad request when validation fails.
      throw new InvalidLogQueryError(validation.errors);
    }

    // The repository handles SQL construction and execution.
    return this.logRepository.queryLogs(validation.value);
  }

  async queryLogAggregates(request: unknown): Promise<LogAggregateResponse> {
    // Normalize and validate the aggregate query parameters first.
    const validation = parseLogAggregateRequest(request);

    if (validation.errors.length > 0 || !validation.value) {
      // Return a structured bad request when validation fails.
      throw new InvalidLogAggregateError(validation.errors);
    }

    // The repository handles SQL construction and execution.
    return this.logRepository.queryLogAggregates(validation.value);
  }
}
