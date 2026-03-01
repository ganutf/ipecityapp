import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  RateLimitError,
  isNeynarError,
  getErrorStatus,
  getErrorMessage,
  getNeynarErrorData,
  getRetryAfter,
  isNotFoundError,
  isRateLimitError,
} from '../errors';

describe('AppError', () => {
  it('creates error with default status 500', () => {
    const err = new AppError('something broke');
    expect(err.message).toBe('something broke');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBeUndefined();
    expect(err).toBeInstanceOf(Error);
  });

  it('creates error with custom status and code', () => {
    const err = new AppError('not found', 404, 'NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});

describe('NotFoundError', () => {
  it('has status 404 and correct code', () => {
    const err = new NotFoundError('resource missing');
    expect(err.message).toBe('resource missing');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.name).toBe('NotFoundError');
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('ValidationError', () => {
  it('has status 400 and correct code', () => {
    const err = new ValidationError('bad input');
    expect(err.message).toBe('bad input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.name).toBe('ValidationError');
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('ForbiddenError', () => {
  it('has status 403 and correct code', () => {
    const err = new ForbiddenError('access denied');
    expect(err.message).toBe('access denied');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.name).toBe('ForbiddenError');
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('RateLimitError', () => {
  it('has status 429, default retryAfter, and correct code', () => {
    const err = new RateLimitError('slow down');
    expect(err.message).toBe('slow down');
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err.name).toBe('RateLimitError');
    expect(err.retryAfter).toBe(60);
    expect(err).toBeInstanceOf(AppError);
  });

  it('accepts custom retryAfter', () => {
    const err = new RateLimitError('slow down', 30);
    expect(err.retryAfter).toBe(30);
  });
});

describe('isNeynarError', () => {
  it('returns false for null/undefined/primitives', () => {
    expect(isNeynarError(null)).toBe(false);
    expect(isNeynarError(undefined)).toBe(false);
    expect(isNeynarError('string')).toBe(false);
    expect(isNeynarError(42)).toBe(false);
  });

  it('returns false for plain objects without message', () => {
    expect(isNeynarError({ statusCode: 500 })).toBe(false);
  });

  it('detects error with statusCode', () => {
    expect(isNeynarError({ message: 'fail', statusCode: 429 })).toBe(true);
  });

  it('detects error with status', () => {
    expect(isNeynarError({ message: 'fail', status: 404 })).toBe(true);
  });

  it('detects error with response object', () => {
    expect(isNeynarError({ message: 'fail', response: { status: 500 } })).toBe(true);
  });
});

describe('getErrorStatus', () => {
  it('returns statusCode from AppError', () => {
    expect(getErrorStatus(new AppError('x', 403))).toBe(403);
  });

  it('returns statusCode from Neynar error', () => {
    expect(getErrorStatus({ message: 'x', statusCode: 429 })).toBe(429);
  });

  it('falls back to status field', () => {
    expect(getErrorStatus({ message: 'x', status: 404 })).toBe(404);
  });

  it('falls back to response.status', () => {
    expect(getErrorStatus({ message: 'x', response: { status: 502 } })).toBe(502);
  });

  it('returns 500 for unknown errors', () => {
    expect(getErrorStatus(new Error('generic'))).toBe(500);
    expect(getErrorStatus('string error')).toBe(500);
    expect(getErrorStatus(null)).toBe(500);
  });
});

describe('getErrorMessage', () => {
  it('returns message from Error instances', () => {
    expect(getErrorMessage(new Error('test'))).toBe('test');
    expect(getErrorMessage(new AppError('app error'))).toBe('app error');
  });

  it('returns string errors directly', () => {
    expect(getErrorMessage('plain string')).toBe('plain string');
  });

  it('returns fallback for non-string/non-Error', () => {
    expect(getErrorMessage(42)).toBe('An unexpected error occurred');
    expect(getErrorMessage(null)).toBe('An unexpected error occurred');
  });
});

describe('getNeynarErrorData', () => {
  it('extracts response data from Neynar error', () => {
    const data = { detail: 'rate limited' };
    const err = { message: 'x', statusCode: 429, response: { data } };
    expect(getNeynarErrorData(err)).toBe(data);
  });

  it('returns undefined for non-Neynar errors', () => {
    expect(getNeynarErrorData(new Error('x'))).toBeUndefined();
  });

  it('returns undefined when no response data', () => {
    expect(getNeynarErrorData({ message: 'x', statusCode: 500 })).toBeUndefined();
  });
});

describe('getRetryAfter', () => {
  it('extracts retry-after header value', () => {
    const err = {
      message: 'rate limited',
      statusCode: 429,
      response: { headers: { 'retry-after': '30' } },
    };
    expect(getRetryAfter(err)).toBe(30);
  });

  it('defaults to 60 when header is missing', () => {
    expect(getRetryAfter({ message: 'x', statusCode: 429 })).toBe(60);
  });

  it('defaults to 60 for non-Neynar errors', () => {
    expect(getRetryAfter(new Error('x'))).toBe(60);
  });
});

describe('isNotFoundError', () => {
  it('detects 404 from status field', () => {
    expect(isNotFoundError({ message: 'x', status: 404 })).toBe(true);
  });

  it('detects 404 from response.status', () => {
    expect(isNotFoundError({ message: 'x', response: { status: 404 } })).toBe(true);
  });

  it('returns false for other status codes', () => {
    expect(isNotFoundError({ message: 'x', status: 500 })).toBe(false);
  });

  it('returns false for non-Neynar errors', () => {
    expect(isNotFoundError(new Error('x'))).toBe(false);
  });
});

describe('isRateLimitError', () => {
  it('detects 429 from status field', () => {
    expect(isRateLimitError({ message: 'x', status: 429 })).toBe(true);
  });

  it('detects 429 from response.status', () => {
    expect(isRateLimitError({ message: 'x', response: { status: 429 } })).toBe(true);
  });

  it('returns false for other status codes', () => {
    expect(isRateLimitError({ message: 'x', status: 500 })).toBe(false);
  });
});
