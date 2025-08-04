/**
 * Date formatting utilities for consistent pulse date display
 */

/**
 * Format a date for pulse display with timezone
 * Returns format: "Tuesday, DD MMM - 05PM (GMT-3)"
 */
export const formatPulseDate = (date: Date, timezone?: string): string => {
  return date.toLocaleString("en-US", {
    weekday: "long",
    day: "2-digit", 
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    timeZoneName: "short"
  });
};

/**
 * Format time difference in a human-readable way
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
 * Get pulse duration display text
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
 * Get contextual timing information for a pulse
 */
export const getContextualTimingInfo = (
  startTime: Date, 
  endTime: Date, 
  currentTime: Date = new Date()
): {
  status: 'future' | 'active' | 'ended';
  timeUntilStart: string | null;
  timeUntilEnd: string | null;
  timeRemaining: string | null;
  contextText: string;
} => {
  const isEnded = currentTime >= endTime;
  const isActive = currentTime >= startTime && currentTime < endTime;
  const isFuture = currentTime < startTime;
  
  let status: 'future' | 'active' | 'ended';
  let timeUntilStart: string | null = null;
  let timeUntilEnd: string | null = null;
  let timeRemaining: string | null = null;
  let contextText: string;
  
  if (isFuture) {
    status = 'future';
    timeUntilStart = formatTimeDifference(startTime.getTime() - currentTime.getTime());
    contextText = `⏰ Starts in ${timeUntilStart}`;
  } else if (isActive) {
    status = 'active';
    timeUntilEnd = formatTimeDifference(endTime.getTime() - currentTime.getTime());
    timeRemaining = timeUntilEnd;
    const timeStarted = formatTimeDifference(currentTime.getTime() - startTime.getTime());
    contextText = `🔥 Started ${timeStarted} ago • ${timeUntilEnd} remaining`;
  } else {
    status = 'ended';
    const timeEnded = formatTimeDifference(currentTime.getTime() - endTime.getTime());
    const duration = formatTimeDifference(endTime.getTime() - startTime.getTime());
    contextText = `✅ Ended ${timeEnded} ago • Was active for ${duration}`;
  }
  
  return {
    status,
    timeUntilStart,
    timeUntilEnd,
    timeRemaining,
    contextText
  };
};