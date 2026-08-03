import type { Request, Response } from "express";
import type { IngestRequest } from "../dto/ingest-request.js";
import type { ILogService } from "../services/interfaces/log-service.js";

export class LogController {
  constructor(private readonly logService: ILogService) {}

  async ingestLogs(req: Request, res: Response): Promise<Response> {
    const result = await this.logService.ingestLogs(req.body as IngestRequest);

    return res.status(200).json(result);
  }
}
