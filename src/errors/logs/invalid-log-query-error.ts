import { BadRequestError } from "../core/bad-request-error.js";

export class InvalidLogQueryError extends BadRequestError {
  constructor(private readonly issues: string[]) {
    // Query validation failures are surfaced as a standard bad request.
    super("invalid log query", "INVALID_LOG_QUERY");
  }

  toResponseBody(): Record<string, unknown> {
    // Include the collected validation issues to help callers fix the query.
    return {
      error: this.message,
      issues: this.issues,
    };
  }
}
