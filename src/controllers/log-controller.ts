import type { Request, Response } from "express";
import type { IngestRequest } from "../dto/ingest/ingest-request.js";
import { InvalidRequestBodyError } from "../errors/http/invalid-request-body-error.js";
import type { ILogService } from "../services/interfaces/log-service.js";
import { isIngestRequest } from "../validation/log-validator.js";

export class LogController {
  constructor(private readonly logService: ILogService) {}

  async ingestLogs(req: Request, res: Response): Promise<Response> {
    if (!isIngestRequest(req.body)) {
      throw new InvalidRequestBodyError();
    }

    const result = await this.logService.ingestLogs(req.body as IngestRequest);

    return res.status(200).json(result);
  }

  async queryLogs(req: Request, res: Response): Promise<Response> {
    const result = await this.logService.queryLogs(req.query);

    return res.status(200).json(result);
  }

  async queryLogAggregates(req: Request, res: Response): Promise<Response> {
    const result = await this.logService.queryLogAggregates(req.query);

    return res.status(200).json(result);
  }
}
