import type { NextFunction, Request, Response } from "express";

export function jsonParseErrorHandler(error: unknown, _req: Request, res: Response, next: NextFunction) {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      error: "malformed JSON",
    });
  }

  return next(error);
}