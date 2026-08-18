import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/core/app-error.js";
import { MalformedJsonError } from "../errors/http/malformed-json-error.js";

export function jsonParseErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (error instanceof SyntaxError && "body" in error) {
    // Express emits a SyntaxError when JSON parsing fails.
    return next(new MalformedJsonError());
  }

  // Unknown errors should continue through the normal error chain.
  return next(error);
}

export function applicationErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof AppError) {
    // Application errors already know how to render themselves.
    return res.status(error.statusCode).json(error.toResponseBody());
  }

  // Unhandled errors are logged and converted into a generic 500 response.
  console.error(error);
  return res.status(500).json({
    error: "internal server error",
  });
}
