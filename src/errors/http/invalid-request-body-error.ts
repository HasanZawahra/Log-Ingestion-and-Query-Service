import { BadRequestError } from "../core/bad-request-error.js";

export class InvalidRequestBodyError extends BadRequestError {
  constructor() {
    super("request body must be an object with an entries array", "INVALID_REQUEST_BODY");
  }
}
