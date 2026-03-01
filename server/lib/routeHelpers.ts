import type { Request, Response } from 'express';
import { AppError, ValidationError, getErrorMessage } from './errors';
import logger from '../logger';

/**
 * Parse an integer URL parameter, throwing ValidationError if invalid.
 */
export function parseIntParam(req: Request, paramName: string): number {
  const value = req.params[paramName];
  const parsed = parseInt(value, 10);

  if (isNaN(parsed) || parsed <= 0) {
    throw new ValidationError(`Invalid ${paramName}: must be a positive integer`);
  }

  return parsed;
}

/**
 * Handle errors thrown by service classes.
 * Maps AppError subclasses to the appropriate HTTP status code.
 * Falls back to 500 for unexpected errors.
 */
export function handleServiceError(
  err: unknown,
  res: Response,
  fallbackMessage: string,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  logger.error(fallbackMessage, err);
  res.status(500).json({ error: getErrorMessage(err) || fallbackMessage });
}
