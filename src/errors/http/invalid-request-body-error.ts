import { BadRequestError } from "../core/bad-request-error.js";

export class InvalidRequestBodyError extends BadRequestError {
  constructor() {
    // The ingest endpoint only accepts a top-level object with an entries array.
    super("request body must be an object with an entries array", "INVALID_REQUEST_BODY");
  }
}
