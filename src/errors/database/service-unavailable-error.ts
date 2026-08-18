import { AppError } from "../core/app-error.js";

export class ServiceUnavailableError extends AppError {
  constructor(message = "unavailable") {
    // Health checks surface the backend's unready state as HTTP 503.
    super(503, message, "SERVICE_UNAVAILABLE");
  }

  toResponseBody(): Record<string, unknown> {
    // The contract only needs to know the service is not ready yet.
    return {
      status: "unavailable",
    };
  }
}
