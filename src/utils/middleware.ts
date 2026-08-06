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
    return next(new MalformedJsonError());
  }

  return next(error);
}

export function applicationErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json(error.toResponseBody());
  }

  console.error(error);
  return res.status(500).json({
    error: "internal server error",
  });
}
