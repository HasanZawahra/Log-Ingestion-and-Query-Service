import { AppError } from "./app-error.js";

export class BadRequestError extends AppError {
  constructor(message: string, code: string = "BAD_REQUEST") {
    // 400 is the shared status for user-correctable request issues.
    super(400, message, code);
  }

  toResponseBody(): Record<string, unknown> {
    // The default bad-request response only needs the message.
    return {
      error: this.message,
    };
  }
}
