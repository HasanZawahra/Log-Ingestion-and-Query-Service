import type { Request, Response } from "express";
import type { IngestRequest } from "../dto/ingest-request.js";
import type { ILogService } from "../services/interfaces/log-service.js";
import { isIngestRequest } from "../validation/log-validator.js";

export class LogController {
  constructor(private readonly logService: ILogService) {}

  async ingestLogs(req: Request, res: Response): Promise<Response> {
    if (!isIngestRequest(req.body)) {
      return res.status(400).json({
        error: "request body must be an object with an entries array",
      });
    }

    const result = await this.logService.ingestLogs(req.body as IngestRequest);

    if (result.accepted === 0) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  }
}
