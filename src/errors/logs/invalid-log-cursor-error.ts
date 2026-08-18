import { BadRequestError } from "../core/bad-request-error.js";

export class InvalidLogCursorError extends BadRequestError {
  constructor() {
    // Cursor strings must decode cleanly into the expected log cursor payload.
    super("cursor must be a valid base64url-encoded log cursor", "INVALID_LOG_CURSOR");
  }
}
