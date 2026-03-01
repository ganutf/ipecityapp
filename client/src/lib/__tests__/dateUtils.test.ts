import { describe, it, expect } from 'vitest';
import {
  formatTimeDifference,
  getPulseDurationText,
  isValidUTCString,
  convertLocalToUTC,
  getTimezoneDisplayName,
} from '../dateUtils';

describe('formatTimeDifference', () => {
  it('formats minutes only', () => {
    expect(formatTimeDifference(5 * 60 * 1000)).toBe('5m');
    expect(formatTimeDifference(45 * 60 * 1000)).toBe('45m');
  });

  it('formats hours only', () => {
    expect(formatTimeDifference(2 * 60 * 60 * 1000)).toBe('2h');
  });

  it('formats hours and minutes', () => {
    expect(formatTimeDifference(2.5 * 60 * 60 * 1000)).toBe('2h 30m');
  });

  it('formats days only', () => {
    expect(formatTimeDifference(48 * 60 * 60 * 1000)).toBe('2d');
  });

  it('formats days and hours', () => {
    expect(formatTimeDifference(26 * 60 * 60 * 1000)).toBe('1d 2h');
  });

  it('handles zero', () => {
    expect(formatTimeDifference(0)).toBe('0m');
  });
});

describe('getPulseDurationText', () => {
  it('formats hours under 24', () => {
    expect(getPulseDurationText(1)).toBe('1h');
    expect(getPulseDurationText(12)).toBe('12h');
    expect(getPulseDurationText(23)).toBe('23h');
  });

  it('formats exact days', () => {
    expect(getPulseDurationText(24)).toBe('1d');
    expect(getPulseDurationText(48)).toBe('2d');
    expect(getPulseDurationText(72)).toBe('3d');
  });

  it('formats days and hours', () => {
    expect(getPulseDurationText(25)).toBe('1d 1h');
    expect(getPulseDurationText(36)).toBe('1d 12h');
    expect(getPulseDurationText(50)).toBe('2d 2h');
  });
});

describe('isValidUTCString', () => {
  it('validates ISO UTC strings', () => {
    expect(isValidUTCString('2026-02-28T10:00:00Z')).toBe(true);
    expect(isValidUTCString('2026-02-28T10:00:00.000Z')).toBe(true);
  });

  it('validates ISO strings without Z suffix', () => {
    expect(isValidUTCString('2026-02-28T10:00:00')).toBe(true);
  });

  it('rejects date-only strings (no T separator)', () => {
    expect(isValidUTCString('2026-02-28')).toBe(false);
  });

  it('rejects invalid date strings', () => {
    expect(isValidUTCString('not-a-date')).toBe(false);
    expect(isValidUTCString('')).toBe(false);
  });
});

describe('convertLocalToUTC', () => {
  it('returns ISO string', () => {
    const date = new Date('2026-02-28T10:00:00Z');
    const result = convertLocalToUTC(date);
    expect(result).toBe('2026-02-28T10:00:00.000Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe('getTimezoneDisplayName', () => {
  it('maps known timezones', () => {
    expect(getTimezoneDisplayName('America/Sao_Paulo')).toBe('Brazil Time');
    expect(getTimezoneDisplayName('America/New_York')).toBe('Eastern Time');
    expect(getTimezoneDisplayName('Europe/London')).toBe('British Time');
    expect(getTimezoneDisplayName('UTC')).toBe('Coordinated Universal Time');
  });

  it('formats unknown timezones from path', () => {
    expect(getTimezoneDisplayName('America/Buenos_Aires')).toBe('Buenos Aires');
  });
});
