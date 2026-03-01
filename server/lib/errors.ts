/**
 * Typed error classes for consistent error handling across the server.
 * Replaces @ts-ignore and `err: any` patterns.
 */

/**
 * Base application error with HTTP status code.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** 404 resource not found */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/** 400 validation failure */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/** 403 forbidden action */
export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

/** 429 rate limit exceeded */
export class RateLimitError extends AppError {
  constructor(
    message: string,
    public retryAfter: number = 60,
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

/**
 * Neynar/external API error shape.
 * Matches the structure from @neynar/nodejs-sdk errors.
 */
export interface NeynarApiError {
  statusCode?: number;
  status?: number;
  message: string;
  response?: {
    status?: number;
    data?: unknown;
    headers?: Record<string, string>;
  };
}

/**
 * Type guard: checks if an unknown error looks like a Neynar API error.
 */
export function isNeynarError(error: unknown): error is NeynarApiError {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as Record<string, unknown>;
  return (
    typeof e.message === 'string' &&
    (typeof e.statusCode === 'number' || typeof e.status === 'number' || typeof e.response === 'object')
  );
}

/**
 * Extract HTTP status from an unknown error.
 * Handles NeynarApiError, AppError, and standard Error.
 */
export function getErrorStatus(error: unknown): number {
  if (error instanceof AppError) return error.statusCode;
  if (isNeynarError(error)) return error.statusCode ?? error.status ?? error.response?.status ?? 500;
  return 500;
}

/**
 * Extract a user-safe error message from an unknown error.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
}

/**
 * Extract response data from a Neynar API error (for forwarding upstream error details).
 */
export function getNeynarErrorData(error: unknown): unknown {
  if (isNeynarError(error) && error.response?.data) return error.response.data;
  return undefined;
}

/**
 * Extract retry-after header value from a rate-limited API error.
 */
export function getRetryAfter(error: unknown): number {
  if (isNeynarError(error)) {
    const raw = error.response?.headers?.['retry-after'];
    if (raw) return parseInt(raw, 10) || 60;
  }
  return 60;
}

/**
 * Check if an error is a 404 from an external API.
 */
export function isNotFoundError(error: unknown): boolean {
  if (isNeynarError(error)) {
    return error.status === 404 || error.response?.status === 404;
  }
  return false;
}

/**
 * Check if an error is a 429 rate limit error.
 */
export function isRateLimitError(error: unknown): boolean {
  if (isNeynarError(error)) {
    return error.status === 429 || error.response?.status === 429;
  }
  return false;
}
