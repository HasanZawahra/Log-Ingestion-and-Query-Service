import { AppError } from "./app-error.js";
import type { IngestResponse } from "../dto/ingest-response.js";

export class AllEntriesRejectedError extends AppError {
  constructor(private readonly response: IngestResponse) {
    super(400, "all log entries were rejected", "ALL_ENTRIES_REJECTED");
  }

  toResponseBody(): IngestResponse {
    return this.response;
  }
}
