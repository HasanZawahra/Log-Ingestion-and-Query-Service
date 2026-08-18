import { AppError } from "../core/app-error.js";
import type { IngestResponse } from "../../dto/ingest/ingest-response.js";

export class AllEntriesRejectedError extends AppError {
  constructor(private readonly response: IngestResponse) {
    // The API returns 400 when the entire batch fails validation.
    super(400, "all log entries were rejected", "ALL_ENTRIES_REJECTED");
  }

  toResponseBody(): IngestResponse {
    // Preserve the detailed rejection list in the HTTP response.
    return this.response;
  }
}
