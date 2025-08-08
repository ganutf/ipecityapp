/**
 * Date formatting utilities for consistent timezone handling across the application
 * All dates should be stored as UTC and converted to user timezone for display
 */

export interface TimezoneInfo {
  timeZone: string;
  displayName: string;
  abbreviation: string;
  offset: string;
}

/**
 * Get comprehensive timezone information for the user
 */
export const getUserTimezoneInfo = (): TimezoneInfo => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  
  // Get timezone abbreviation
  const abbreviation = now.toLocaleString('en-US', {
    timeZone,
    timeZoneName: 'short'
  }).split(' ').pop() || '';
  
  // Get offset
  const offset = now.toLocaleString('en-US', {
    timeZone,
    timeZoneName: 'longOffset'
  }).split(' ').pop() || '';
  
  // Create display name
  const displayName = getTimezoneDisplayName(timeZone);
  
  return {
    timeZone,
    displayName,
    abbreviation,
    offset
  };
};

/**
 * Convert timezone identifier to human-readable display name
 */
export const getTimezoneDisplayName = (timeZone: string): string => {
  const timeZoneMap: Record<string, string> = {
    'America/Sao_Paulo': 'Brazil Time',
    'America/New_York': 'Eastern Time',
    'America/Chicago': 'Central Time', 
    'America/Denver': 'Mountain Time',
    'America/Los_Angeles': 'Pacific Time',
    'Europe/London': 'British Time',
    'Europe/Paris': 'Central European Time',
    'Europe/Berlin': 'Central European Time',
    'Asia/Tokyo': 'Japan Time',
    'Asia/Shanghai': 'China Time',
    'Australia/Sydney': 'Australian Eastern Time',
    'UTC': 'Coordinated Universal Time'
  };
  
  return timeZoneMap[timeZone] || timeZone.replace('_', ' ').split('/').pop() || timeZone;
};

/**
 * Convert UTC datetime string to user's local timezone
 * @param utcDateString - ISO UTC datetime string
 * @param userTimeZone - Optional timezone, defaults to user's detected timezone
 */
export const convertUTCToUserTimezone = (utcDateString: string | Date, userTimeZone?: string): Date => {
  const utcDate = typeof utcDateString === 'string' ? new Date(utcDateString) : utcDateString;
  
  // Ensure we're working with a valid UTC date
  if (isNaN(utcDate.getTime())) {
    throw new Error(`Invalid UTC date: ${utcDateString}`);
  }
  
  return utcDate; // Date object automatically handles timezone conversion for display
};

/**
 * Convert local datetime to UTC for server storage
 * @param localDate - Local date object
 */
export const convertLocalToUTC = (localDate: Date): string => {
  return localDate.toISOString();
};

/**
 * Format a UTC datetime for pulse display with timezone information
 * Returns format: "Tuesday, DD MMM - 05PM Brazil Time (GMT-3)"
 * @param utcDateString - UTC datetime string from server
 * @param userTimeZone - Optional timezone override
 * @param showTimezoneName - Whether to show timezone display name
 */
export const formatPulseDate = (utcDateString: string | Date, userTimeZone?: string, showTimezoneName: boolean = true): string => {
  const date = convertUTCToUserTimezone(utcDateString, userTimeZone);
  const timeZone = userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const formattedDate = date.toLocaleString("en-US", {
    weekday: "long",
    day: "2-digit", 
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone,
    timeZoneName: "short"
  });
  
  if (showTimezoneName) {
    const displayName = getTimezoneDisplayName(timeZone);
    // Replace the short timezone name with our display name only
    const parts = formattedDate.split(' ');
    const shortTzName = parts[parts.length - 1];
    return formattedDate.replace(shortTzName, displayName);
  }
  
  return formattedDate;
};

/**
 * Format a UTC datetime for compact display
 * Returns format: "Dec 25, 2PM EST"
 */
export const formatCompactDateTime = (utcDateString: string | Date, userTimeZone?: string): string => {
  const date = convertUTCToUserTimezone(utcDateString, userTimeZone);
  const timeZone = userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    hour12: true,
    timeZone,
    timeZoneName: "short"
  });
};

/**
 * Check if a UTC datetime is in the user's "today"
 */
export const isToday = (utcDateString: string | Date, userTimeZone?: string): boolean => {
  const date = convertUTCToUserTimezone(utcDateString, userTimeZone);
  const today = new Date();
  const timeZone = userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const dateStr = date.toLocaleDateString('en-CA', { timeZone }); // YYYY-MM-DD format
  const todayStr = today.toLocaleDateString('en-CA', { timeZone });
  
  return dateStr === todayStr;
};

/**
 * Format time difference in a human-readable way
 * Enhanced version with more granular time units
 */
export const formatTimeDifference = (diffMs: number): string => {
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  
  return `${minutes}m`;
};

/**
 * Get pulse duration display text with timezone awareness
 * @param intervalHours - Duration in hours
 */
export const getPulseDurationText = (intervalHours: number): string => {
  if (intervalHours < 24) {
    return `${intervalHours}h`;
  }
  
  const days = Math.floor(intervalHours / 24);
  const hours = intervalHours % 24;
  
  if (hours === 0) {
    return `${days}d`;
  }
  
  return `${days}d ${hours}h`;
};

/**
 * Get contextual timing information for a pulse with timezone awareness
 * @param utcStartTime - UTC start time string or Date
 * @param utcEndTime - UTC end time string or Date
 * @param currentUTCTime - Current UTC time, defaults to now
 * @param userTimeZone - Optional timezone for display context
 */
export const getContextualTimingInfo = (
  utcStartTime: string | Date, 
  utcEndTime: string | Date, 
  currentUTCTime: Date = new Date(),
  userTimeZone?: string
): {
  status: 'future' | 'active' | 'ended';
  timeUntilStart: string | null;
  timeUntilEnd: string | null;
  timeRemaining: string | null;
  contextText: string;
  localStartTime: Date;
  localEndTime: Date;
} => {
  const startTime = convertUTCToUserTimezone(utcStartTime, userTimeZone);
  const endTime = convertUTCToUserTimezone(utcEndTime, userTimeZone);
  const currentTime = currentUTCTime; // Work with UTC for calculations
  
  // Convert to UTC for accurate comparisons
  const utcStart = typeof utcStartTime === 'string' ? new Date(utcStartTime) : utcStartTime;
  const utcEnd = typeof utcEndTime === 'string' ? new Date(utcEndTime) : utcEndTime;
  
  const isEnded = currentTime >= utcEnd;
  const isActive = currentTime >= utcStart && currentTime < utcEnd;
  const isFuture = currentTime < utcStart;
  
  let status: 'future' | 'active' | 'ended';
  let timeUntilStart: string | null = null;
  let timeUntilEnd: string | null = null;
  let timeRemaining: string | null = null;
  let contextText: string;
  
  const timezoneInfo = getUserTimezoneInfo();
  const tzName = userTimeZone ? getTimezoneDisplayName(userTimeZone) : timezoneInfo.displayName;
  
  if (isFuture) {
    status = 'future';
    timeUntilStart = formatTimeDifference(utcStart.getTime() - currentTime.getTime());
    contextText = `⏰ Starts in ${timeUntilStart}`;
  } else if (isActive) {
    status = 'active';
    timeUntilEnd = formatTimeDifference(utcEnd.getTime() - currentTime.getTime());
    timeRemaining = timeUntilEnd;
    const timeStarted = formatTimeDifference(currentTime.getTime() - utcStart.getTime());
    contextText = `🔥 Started ${timeStarted} ago • ${timeUntilEnd} remaining`;
  } else {
    status = 'ended';
    const timeEnded = formatTimeDifference(currentTime.getTime() - utcEnd.getTime());
    const duration = formatTimeDifference(utcEnd.getTime() - utcStart.getTime());
    contextText = `✅ Ended ${timeEnded} ago • Was active for ${duration}`;
  }
  
  return {
    status,
    timeUntilStart,
    timeUntilEnd,
    timeRemaining,
    contextText,
    localStartTime: startTime,
    localEndTime: endTime
  };
};

/**
 * Validate if a datetime string is a valid UTC ISO string
 */
export const isValidUTCString = (dateString: string): boolean => {
  try {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && dateString.includes('T');
  } catch {
    return false;
  }
};

/**
 * Get current UTC time as ISO string
 */
export const getCurrentUTC = (): string => {
  return new Date().toISOString();
};

/**
 * Format UTC datetime for form inputs (datetime-local format)
 * Converts UTC to user's local time for datetime-local input
 */
export const formatForDateTimeInput = (utcDateString: string | Date, userTimeZone?: string): string => {
  const date = convertUTCToUserTimezone(utcDateString, userTimeZone);
  const timeZone = userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Create a date in the user's timezone for form input
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Convert datetime-local input value to UTC string
 * @param localDateTimeValue - Value from datetime-local input
 * @param userTimeZone - User's timezone for accurate conversion
 */
export const convertDateTimeInputToUTC = (localDateTimeValue: string, userTimeZone?: string): string => {
  // The datetime-local input gives us a string like "2024-12-25T14:30"
  // We need to interpret this in the user's timezone and convert to UTC
  const timeZone = userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Create a date object assuming the input is in the user's timezone
  const [datePart, timePart] = localDateTimeValue.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  
  // Create date in UTC, then adjust for timezone offset
  const localDate = new Date(year, month - 1, day, hour, minute);
  
  return localDate.toISOString();
};