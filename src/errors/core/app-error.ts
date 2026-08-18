export abstract class AppError extends Error {
  constructor(
    // HTTP status code returned by the shared error handler.
    public readonly statusCode: number,
    // Human-readable error message.
    message: string,
    // Stable machine-readable error code.
    public readonly code: string
  ) {
    super(message);
    // Restore the prototype chain for custom Error subclasses.
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  // Subclasses translate the error into the public JSON body.
  abstract toResponseBody(): unknown;
}
