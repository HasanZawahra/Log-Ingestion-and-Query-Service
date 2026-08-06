import { AppError } from "../core/app-error.js";

export class ServiceUnavailableError extends AppError {
  constructor(message = "unavailable") {
    super(503, message, "SERVICE_UNAVAILABLE");
  }

  toResponseBody(): Record<string, unknown> {
    return {
      status: "unavailable",
    };
  }
}
