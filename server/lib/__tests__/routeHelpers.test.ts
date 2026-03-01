import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { parseIntParam, handleServiceError } from '../routeHelpers';
import { AppError, NotFoundError, ValidationError, ForbiddenError } from '../errors';

function mockRequest(params: Record<string, string> = {}): Request {
  return { params } as unknown as Request;
}

function mockResponse() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe('parseIntParam', () => {
  it('parses a valid positive integer', () => {
    const req = mockRequest({ id: '42' });
    expect(parseIntParam(req, 'id')).toBe(42);
  });

  it('throws ValidationError for non-numeric string', () => {
    const req = mockRequest({ id: 'abc' });
    expect(() => parseIntParam(req, 'id')).toThrow(ValidationError);
    expect(() => parseIntParam(req, 'id')).toThrow('Invalid id');
  });

  it('throws ValidationError for zero', () => {
    const req = mockRequest({ id: '0' });
    expect(() => parseIntParam(req, 'id')).toThrow(ValidationError);
  });

  it('throws ValidationError for negative numbers', () => {
    const req = mockRequest({ id: '-5' });
    expect(() => parseIntParam(req, 'id')).toThrow(ValidationError);
  });

  it('throws ValidationError for missing param', () => {
    const req = mockRequest({});
    expect(() => parseIntParam(req, 'id')).toThrow(ValidationError);
  });

  it('includes param name in error message', () => {
    const req = mockRequest({ pulseId: 'bad' });
    try {
      parseIntParam(req, 'pulseId');
    } catch (err) {
      expect((err as Error).message).toContain('pulseId');
    }
  });
});

describe('handleServiceError', () => {
  it('maps AppError subclass to correct status', () => {
    const res = mockResponse();
    handleServiceError(new NotFoundError('not found'), res, 'fallback');
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('maps ValidationError to 400', () => {
    const res = mockResponse();
    handleServiceError(new ValidationError('bad input'), res, 'fallback');
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'bad input' });
  });

  it('maps ForbiddenError to 403', () => {
    const res = mockResponse();
    handleServiceError(new ForbiddenError('denied'), res, 'fallback');
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'denied' });
  });

  it('maps generic AppError to its statusCode', () => {
    const res = mockResponse();
    handleServiceError(new AppError('custom', 418), res, 'fallback');
    expect(res.statusCode).toBe(418);
  });

  it('falls back to 500 for unknown errors', () => {
    const res = mockResponse();
    handleServiceError(new Error('unexpected'), res, 'fallback msg');
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'unexpected' });
  });

  it('uses getErrorMessage for non-Error objects', () => {
    const res = mockResponse();
    handleServiceError(42, res, 'something went wrong');
    expect(res.statusCode).toBe(500);
    // getErrorMessage(42) returns generic fallback, not the route fallback
    expect(res.body).toEqual({ error: 'An unexpected error occurred' });
  });
});
