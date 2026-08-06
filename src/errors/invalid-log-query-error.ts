import { BadRequestError } from "./bad-request-error.js";

export class InvalidLogQueryError extends BadRequestError {
  constructor(private readonly issues: string[]) {
    super("invalid log query", "INVALID_LOG_QUERY");
  }

  toResponseBody(): Record<string, unknown> {
    return {
      error: this.message,
      issues: this.issues,
    };
  }
}
