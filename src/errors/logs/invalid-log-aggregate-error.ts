import { BadRequestError } from "../core/bad-request-error.js";

export class InvalidLogAggregateError extends BadRequestError {
  constructor(private readonly issues: string[]) {
    super("invalid log aggregate query", "INVALID_LOG_AGGREGATE");
  }

  toResponseBody(): Record<string, unknown> {
    return {
      error: this.message,
      issues: this.issues,
    };
  }
}
