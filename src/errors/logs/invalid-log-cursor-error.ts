import { BadRequestError } from "../core/bad-request-error.js";

export class InvalidLogCursorError extends BadRequestError {
  constructor() {
    super("cursor must be a valid base64url-encoded log cursor", "INVALID_LOG_CURSOR");
  }
}
