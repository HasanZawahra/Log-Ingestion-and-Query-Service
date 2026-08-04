import { AppError } from "./app-error.js";

export class BadRequestError extends AppError {
  constructor(message: string, code: string = "BAD_REQUEST") {
    super(400, message, code);
  }

  toResponseBody(): Record<string, unknown> {
    return {
      error: this.message,
    };
  }
}
