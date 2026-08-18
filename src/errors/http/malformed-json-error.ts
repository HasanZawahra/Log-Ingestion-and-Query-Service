import { BadRequestError } from "../core/bad-request-error.js";

export class MalformedJsonError extends BadRequestError {
  constructor() {
    // Express could not parse the request body as valid JSON.
    super("malformed JSON", "MALFORMED_JSON");
  }
}
