import { BadRequestError } from "../core/bad-request-error.js";

export class InvalidLogAggregateError extends BadRequestError {
  constructor(private readonly issues: string[]) {
    // Aggregate query validation failures are reported as a bad request.
    super("invalid log aggregate query", "INVALID_LOG_AGGREGATE");
  }

  toResponseBody(): Record<string, unknown> {
    // Mirror the validation issues so the caller can correct the request.
    return {
      error: this.message,
      issues: this.issues,
    };
  }
}
