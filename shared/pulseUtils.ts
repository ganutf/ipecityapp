/**
 * Shared pulse utilities for consistent business logic across client and server
 * All timing calculations work with UTC timestamps for global consistency
 */

export interface PulseTimingInfo {
  status: 'active' | 'ended' | 'future';
  isActive: boolean;
  isEnded: boolean;
  isFuture: boolean;
}

export interface ExecutionStatus {
  liked: boolean;
  shared: boolean;
  abstained: boolean;
  hasExecution?: boolean;
}

/**
 * Gets the timing status of a pulse based on UTC start time and interval
 * All calculations work in UTC to ensure consistency across timezones
 * @param datetimeStart - UTC datetime string or Date object from server
 * @param interval - Duration in hours
 * @param currentUTCTime - Current UTC time, defaults to now
 */
export function getPulseTimingInfo(
  datetimeStart: string | Date,
  interval: number,
  currentUTCTime: Date = new Date()
): PulseTimingInfo {
  // Ensure we're working with UTC dates
  const utcStartTime = typeof datetimeStart === 'string' ? new Date(datetimeStart) : datetimeStart;
  const utcEndTime = new Date(utcStartTime.getTime() + (interval * 60 * 60 * 1000));
  
  // Validate dates
  if (isNaN(utcStartTime.getTime())) {
    throw new Error(`Invalid start time: ${datetimeStart}`);
  }
  
  // All comparisons in UTC
  const isEnded = currentUTCTime > utcEndTime;
  const isActive = currentUTCTime >= utcStartTime && currentUTCTime <= utcEndTime;
  const isFuture = currentUTCTime < utcStartTime;

  return {
    status: isEnded ? 'ended' : isActive ? 'active' : 'future',
    isActive,
    isEnded,
    isFuture
  };
}

/**
 * Determines if a pulse is currently active (within its time window)
 * @param datetimeStart - UTC datetime string or Date object
 * @param interval - Duration in hours
 * @param currentUTCTime - Current UTC time, defaults to now
 */
export function isPulseActive(
  datetimeStart: string | Date,
  interval: number,
  currentUTCTime: Date = new Date()
): boolean {
  const timingInfo = getPulseTimingInfo(datetimeStart, interval, currentUTCTime);
  return timingInfo.isActive;
}

/**
 * Determines if a pulse has been executed by the user
 * @param executionStatus - The execution status object
 */
export function hasUserExecuted(executionStatus?: ExecutionStatus | null): boolean {
  if (!executionStatus) return false;
  return Boolean(
    executionStatus.hasExecution || 
    executionStatus.liked || 
    executionStatus.shared || 
    executionStatus.abstained
  );
}

/**
 * Calculate pulse end time in UTC
 * @param pulseStartUTC - UTC start time
 * @param intervalHours - Duration in hours
 */
export function calculatePulseEndTimeUTC(pulseStartUTC: Date, intervalHours: number): Date {
  return new Date(pulseStartUTC.getTime() + (intervalHours * 60 * 60 * 1000));
}

/**
 * Get current UTC timestamp for consistent server operations
 */
export function getCurrentUTC(): Date {
  return new Date();
}