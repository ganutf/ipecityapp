import { describe, it, expect } from 'vitest';
import {
  getCardAccentColor,
  getStatusBadge,
  extractExecutionStatus,
  getTimeRemainingMs,
} from '../pulseUtils';

describe('getCardAccentColor', () => {
  const start = '2026-02-28T10:00:00Z';

  it('returns green when user has executed', () => {
    const status = { liked: true, shared: false, abstained: false };
    expect(getCardAccentColor(status)).toBe('border-l-green-500');
  });

  it('returns orange for active pulse without execution', () => {
    const now = new Date('2026-02-28T12:00:00Z');
    expect(getCardAccentColor(null, start, 24, now)).toBe('border-l-orange-500');
  });

  it('returns blue for future pulse', () => {
    const now = new Date('2026-02-28T08:00:00Z');
    expect(getCardAccentColor(null, start, 24, now)).toBe('border-l-blue-500');
  });

  it('returns gray for ended pulse', () => {
    const now = new Date('2026-03-02T00:00:00Z');
    expect(getCardAccentColor(null, start, 24, now)).toBe('border-l-gray-400');
  });

  it('returns default when no timing info', () => {
    expect(getCardAccentColor(null)).toBe('border-l-gray-300');
  });

  it('prioritizes execution status over timing', () => {
    const executed = { liked: true, shared: false, abstained: false };
    const now = new Date('2026-02-28T12:00:00Z');
    expect(getCardAccentColor(executed, start, 24, now)).toBe('border-l-green-500');
  });
});

describe('getStatusBadge', () => {
  const start = '2026-02-28T10:00:00Z';

  it('returns "Active" badge for active pulse without execution', () => {
    const now = new Date('2026-02-28T12:00:00Z');
    const badge = getStatusBadge(null, start, 24, now);
    expect(badge?.text).toBe('Active');
  });

  it('returns "Executed" badge for active pulse with execution', () => {
    const executed = { liked: true, shared: false, abstained: false };
    const now = new Date('2026-02-28T12:00:00Z');
    const badge = getStatusBadge(executed, start, 24, now);
    expect(badge?.text).toBe('Executed');
  });

  it('returns "Ended" badge for ended pulse', () => {
    const now = new Date('2026-03-02T00:00:00Z');
    const badge = getStatusBadge(null, start, 24, now);
    expect(badge?.text).toBe('Ended');
  });

  it('returns "Scheduled" badge for future pulse', () => {
    const now = new Date('2026-02-28T08:00:00Z');
    const badge = getStatusBadge(null, start, 24, now);
    expect(badge?.text).toBe('Scheduled');
  });

  it('returns null when no timing info provided', () => {
    expect(getStatusBadge(null)).toBeNull();
  });
});

describe('extractExecutionStatus', () => {
  it('returns default for null data', () => {
    const status = extractExecutionStatus(null, 1);
    expect(status).toEqual({
      liked: false,
      shared: false,
      abstained: false,
      hasExecution: false,
    });
  });

  it('extracts from executionDetails format', () => {
    const data = {
      executionDetails: [
        {
          pulse: { id: 1 },
          execution: { actions: { liked: true, shared: false, abstained: false } },
        },
      ],
    };
    const status = extractExecutionStatus(data, 1);
    expect(status.liked).toBe(true);
  });

  it('returns default when pulse not found in details', () => {
    const data = {
      executionDetails: [
        {
          pulse: { id: 99 },
          execution: { actions: { liked: true, shared: false, abstained: false } },
        },
      ],
    };
    const status = extractExecutionStatus(data, 1);
    expect(status.hasExecution).toBe(false);
  });

  it('extracts from direct executions format', () => {
    const data = {
      executions: [
        { pulseId: 5, actions: { liked: false, shared: true, abstained: false } },
      ],
    };
    const status = extractExecutionStatus(data, 5);
    expect(status.shared).toBe(true);
  });
});

describe('getTimeRemainingMs', () => {
  const start = '2026-02-28T10:00:00Z';

  it('returns remaining time for active pulse', () => {
    const now = new Date('2026-02-28T12:00:00Z');
    const remaining = getTimeRemainingMs(start, 24, now);
    // 22 hours remaining
    expect(remaining).toBe(22 * 60 * 60 * 1000);
  });

  it('returns null for ended pulse', () => {
    const now = new Date('2026-03-02T00:00:00Z');
    expect(getTimeRemainingMs(start, 24, now)).toBeNull();
  });

  it('returns full duration for future pulse (calculates from end)', () => {
    const now = new Date('2026-02-28T08:00:00Z');
    const remaining = getTimeRemainingMs(start, 24, now);
    // 26 hours until end (2h until start + 24h duration)
    expect(remaining).toBe(26 * 60 * 60 * 1000);
  });
});
