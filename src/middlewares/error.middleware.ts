import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import { logger } from "../utils/logger";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ApiError) {
    if (!err.isOperational) logger.error(err.stack ?? err.message);
    return res.status(err.statusCode).json({ message: err.message });
  }

  logger.error(err.stack ?? err.message);
  return res.status(500).json({ message: "Internal server error" });
}
