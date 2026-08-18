import type { Request, Response } from "express";
import type { IngestRequest } from "../dto/ingest/ingest-request.js";
import { InvalidRequestBodyError } from "../errors/http/invalid-request-body-error.js";
import type { ILogService } from "../services/interfaces/log-service.js";
import { normalizeIngestRequest } from "../validation/log-validator.js";

export class LogController {
  constructor(private readonly logService: ILogService) {}

  async ingestLogs(req: Request, res: Response): Promise<Response> {
    // Normalize the body before handing it to the ingest service.
    const request = normalizeIngestRequest(req.body);

    if (!request) {
      // Reject bodies that do not match the expected top-level shape.
      throw new InvalidRequestBodyError();
    }

    // The service handles per-entry validation and persistence.
    const result = await this.logService.ingestLogs(request as IngestRequest);

    return res.status(200).json(result);
  }

  async queryLogs(req: Request, res: Response): Promise<Response> {
    // Query validation is handled by the service layer.
    const result = await this.logService.queryLogs(req.query);

    return res.status(200).json(result);
  }

  async queryLogAggregates(req: Request, res: Response): Promise<Response> {
    // Aggregate validation is handled by the service layer.
    const result = await this.logService.queryLogAggregates(req.query);

    return res.status(200).json(result);
  }
}
