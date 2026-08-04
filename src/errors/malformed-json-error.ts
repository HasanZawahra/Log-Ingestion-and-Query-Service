import { BadRequestError } from "./bad-request-error.js";

export class MalformedJsonError extends BadRequestError {
  constructor() {
    super("malformed JSON", "MALFORMED_JSON");
  }
}
