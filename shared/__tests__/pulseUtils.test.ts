import { describe, it, expect } from 'vitest';
import {
  getPulseTimingInfo,
  isPulseActive,
  hasUserExecuted,
  calculatePulseEndTimeUTC,
} from '../pulseUtils';

describe('getPulseTimingInfo', () => {
  const startTime = '2026-02-28T10:00:00Z';
  const interval = 24; // 24 hours

  it('marks pulse as future before start time', () => {
    const now = new Date('2026-02-28T09:00:00Z');
    const info = getPulseTimingInfo(startTime, interval, now);
    expect(info.status).toBe('future');
    expect(info.isFuture).toBe(true);
    expect(info.isActive).toBe(false);
    expect(info.isEnded).toBe(false);
  });

  it('marks pulse as active at start time', () => {
    const now = new Date('2026-02-28T10:00:00Z');
    const info = getPulseTimingInfo(startTime, interval, now);
    expect(info.status).toBe('active');
    expect(info.isActive).toBe(true);
    expect(info.isFuture).toBe(false);
    expect(info.isEnded).toBe(false);
  });

  it('marks pulse as active during the window', () => {
    const now = new Date('2026-02-28T20:00:00Z');
    const info = getPulseTimingInfo(startTime, interval, now);
    expect(info.status).toBe('active');
    expect(info.isActive).toBe(true);
  });

  it('marks pulse as active at end time (inclusive)', () => {
    const now = new Date('2026-03-01T10:00:00Z');
    const info = getPulseTimingInfo(startTime, interval, now);
    expect(info.status).toBe('active');
    expect(info.isActive).toBe(true);
  });

  it('marks pulse as ended after end time', () => {
    const now = new Date('2026-03-01T10:00:01Z');
    const info = getPulseTimingInfo(startTime, interval, now);
    expect(info.status).toBe('ended');
    expect(info.isEnded).toBe(true);
    expect(info.isActive).toBe(false);
  });

  it('accepts Date objects for start time', () => {
    const start = new Date('2026-02-28T10:00:00Z');
    const now = new Date('2026-02-28T15:00:00Z');
    const info = getPulseTimingInfo(start, 24, now);
    expect(info.isActive).toBe(true);
  });

  it('throws on invalid date string', () => {
    expect(() => getPulseTimingInfo('invalid', 24)).toThrow('Invalid start time');
  });

  it('handles short intervals', () => {
    const now = new Date('2026-02-28T10:30:00Z');
    const info = getPulseTimingInfo(startTime, 1, now); // 1 hour
    expect(info.status).toBe('active');

    const after = new Date('2026-02-28T11:01:00Z');
    const infoAfter = getPulseTimingInfo(startTime, 1, after);
    expect(infoAfter.status).toBe('ended');
  });
});

describe('isPulseActive', () => {
  it('returns true during active window', () => {
    const now = new Date('2026-02-28T12:00:00Z');
    expect(isPulseActive('2026-02-28T10:00:00Z', 24, now)).toBe(true);
  });

  it('returns false before start', () => {
    const now = new Date('2026-02-28T08:00:00Z');
    expect(isPulseActive('2026-02-28T10:00:00Z', 24, now)).toBe(false);
  });

  it('returns false after end', () => {
    const now = new Date('2026-03-02T00:00:00Z');
    expect(isPulseActive('2026-02-28T10:00:00Z', 24, now)).toBe(false);
  });
});

describe('hasUserExecuted', () => {
  it('returns false for null/undefined', () => {
    expect(hasUserExecuted(null)).toBe(false);
    expect(hasUserExecuted(undefined)).toBe(false);
  });

  it('returns false when nothing is set', () => {
    expect(hasUserExecuted({ liked: false, shared: false, abstained: false })).toBe(false);
  });

  it('returns true for liked', () => {
    expect(hasUserExecuted({ liked: true, shared: false, abstained: false })).toBe(true);
  });

  it('returns true for shared', () => {
    expect(hasUserExecuted({ liked: false, shared: true, abstained: false })).toBe(true);
  });

  it('returns true for abstained', () => {
    expect(hasUserExecuted({ liked: false, shared: false, abstained: true })).toBe(true);
  });

  it('returns true for hasExecution flag', () => {
    expect(hasUserExecuted({ liked: false, shared: false, abstained: false, hasExecution: true })).toBe(true);
  });
});

describe('calculatePulseEndTimeUTC', () => {
  it('adds interval hours to start time', () => {
    const start = new Date('2026-02-28T10:00:00Z');
    const end = calculatePulseEndTimeUTC(start, 24);
    expect(end.toISOString()).toBe('2026-03-01T10:00:00.000Z');
  });

  it('handles fractional hours', () => {
    const start = new Date('2026-02-28T10:00:00Z');
    const end = calculatePulseEndTimeUTC(start, 1.5);
    expect(end.toISOString()).toBe('2026-02-28T11:30:00.000Z');
  });

  it('handles zero interval', () => {
    const start = new Date('2026-02-28T10:00:00Z');
    const end = calculatePulseEndTimeUTC(start, 0);
    expect(end.getTime()).toBe(start.getTime());
  });
});
