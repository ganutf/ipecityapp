/**
 * Client-side pulse utilities that extend shared utilities with UI-specific functionality
 * Core business logic is imported from shared utilities for consistency
 */

import { convertUTCToUserTimezone, getCurrentUTC, formatTimeDifference } from './dateUtils';
import type { Pulse } from '@shared/schema';

// Import shared business logic
import { 
  getPulseTimingInfo, 
  hasUserExecuted, 
  isPulseActive, 
  calculatePulseEndTimeUTC,
  type PulseTimingInfo, 
  type ExecutionStatus 
} from '@shared/pulseUtils';

// Re-export for backward compatibility
export { 
  getPulseTimingInfo, 
  hasUserExecuted, 
  isPulseActive, 
  calculatePulseEndTimeUTC,
  type PulseTimingInfo, 
  type ExecutionStatus 
};

/**
 * Gets the appropriate card accent border color based on execution and timing status
 * Uses UTC-based timing calculations for consistency
 */
export function getCardAccentColor(
  executionStatus?: ExecutionStatus | null,
  datetimeStart?: string | Date,
  interval?: number,
  currentUTCTime?: Date
): string {
  // If user has executed, always show green
  if (hasUserExecuted(executionStatus)) {
    return "border-l-green-500";
  }

  // If timing info is available, use timing-based colors
  if (datetimeStart && interval) {
    const timingInfo = getPulseTimingInfo(datetimeStart, interval, currentUTCTime);
    
    switch (timingInfo.status) {
      case 'active':
        return "border-l-orange-500";
      case 'future':
        return "border-l-blue-500";
      case 'ended':
        return "border-l-gray-400";
      default:
        return "border-l-gray-300";
    }
  }

  // Default fallback
  return "border-l-gray-300";
}

/**
 * Gets the appropriate status badge configuration
 * Uses UTC-based timing calculations for consistency
 */
export function getStatusBadge(
  executionStatus?: ExecutionStatus | null,
  datetimeStart?: string | Date,
  interval?: number,
  currentUTCTime?: Date
): { className: string; text: string } | null {
  const baseClasses = "px-3 py-1.5 text-sm font-semibold rounded-full";

  // If timing info is available, determine status
  if (datetimeStart && interval) {
    const timingInfo = getPulseTimingInfo(datetimeStart, interval, currentUTCTime);
    
    if (timingInfo.isActive) {
      // For active pulses, show execution status if available
      if (hasUserExecuted(executionStatus)) {
        return {
          className: `${baseClasses} bg-green-500 text-white`,
          text: "Executed"
        };
      } else {
        return {
          className: `${baseClasses} bg-orange-500 text-white`,
          text: "Active"
        };
      }
    } else if (timingInfo.isEnded) {
      return {
        className: `${baseClasses} bg-gray-500 text-white`,
        text: "Ended"
      };
    } else if (timingInfo.isFuture) {
      return {
        className: `${baseClasses} bg-blue-500 text-white`,
        text: "Scheduled"
      };
    }
  }

  return null;
}

/**
 * Helper to convert actions object to ExecutionStatus
 * Timezone-aware helper for execution status parsing
 */
function actionsToExecutionStatus(actions: any, hasExecution: boolean = true): ExecutionStatus {
  return {
    liked: actions?.liked || false,
    shared: actions?.shared || false,
    abstained: actions?.abstained || false,
    hasExecution
  };
}

/**
 * Extracts execution status from different API response formats
 * Handles timezone-aware execution data parsing
 */
export function extractExecutionStatus(
  executionData: any,
  pulseId: number
): ExecutionStatus {
  if (!executionData) {
    return { liked: false, shared: false, abstained: false, hasExecution: false };
  }

  // Format from /api/executions/{id}/details
  if (executionData.executionDetails) {
    const detail = executionData.executionDetails.find(
      (detail: any) => detail.pulse?.id === pulseId
    );
    if (detail?.execution?.actions) {
      return actionsToExecutionStatus(detail.execution.actions, Boolean(detail.execution));
    }
  }

  // Formats from /api/pulse/{id}/executions and /api/executions/by-fid/{fid}
  if (executionData.executions) {
    // Try nested execution format first (from /api/pulse/{id}/executions)
    const executionWithMember = executionData.executions.find(
      (exec: any) => exec.member?.farcasterFid && exec.execution?.actions
    );
    if (executionWithMember?.execution?.actions) {
      return actionsToExecutionStatus(executionWithMember.execution.actions, Boolean(executionWithMember.execution));
    }

    // Try direct execution format (from /api/executions/by-fid/{fid})
    const directExecution = executionData.executions.find(
      (exec: any) => exec.pulseId === pulseId && exec.actions
    );
    if (directExecution?.actions) {
      return actionsToExecutionStatus(directExecution.actions, Boolean(directExecution));
    }
  }

  return { liked: false, shared: false, abstained: false, hasExecution: false };
}

/**
 * Calculate time remaining until pulse ends (in UTC)
 * @param datetimeStart - UTC start time
 * @param interval - Duration in hours
 * @param currentUTCTime - Current UTC time
 * @returns Milliseconds until end, or null if pulse has ended
 */
export function getTimeRemainingMs(
  datetimeStart: string | Date,
  interval: number,
  currentUTCTime: Date = new Date()
): number | null {
  const utcStartTime = typeof datetimeStart === 'string' ? new Date(datetimeStart) : datetimeStart;
  const utcEndTime = new Date(utcStartTime.getTime() + (interval * 60 * 60 * 1000));
  
  if (currentUTCTime >= utcEndTime) {
    return null; // Pulse has ended
  }
  
  return utcEndTime.getTime() - currentUTCTime.getTime();
}

/**
 * Get pulse times in user's timezone for display
 * @param utcDatetimeStart - UTC start time from server
 * @param interval - Duration in hours
 * @param userTimeZone - Optional timezone override
 */
export function getPulseLocalTimes(
  utcDatetimeStart: string | Date,
  interval: number,
  userTimeZone?: string
): { localStartTime: Date; localEndTime: Date } {
  const localStartTime = convertUTCToUserTimezone(utcDatetimeStart, userTimeZone);
  const utcStart = typeof utcDatetimeStart === 'string' ? new Date(utcDatetimeStart) : utcDatetimeStart;
  const utcEnd = new Date(utcStart.getTime() + (interval * 60 * 60 * 1000));
  const localEndTime = convertUTCToUserTimezone(utcEnd, userTimeZone);
  
  return { localStartTime, localEndTime };
}

/**
 * Get timing info string for an active pulse (for display in PostTool header).
 */
export function getActivePulseTimingInfo(pulse: Pulse, currentTime: Date = new Date()): string {
  const startTime = new Date(pulse.datetimeStart);
  const endTime = new Date(startTime.getTime() + (pulse.interval || 24) * 60 * 60 * 1000);
  const timeRemaining = formatTimeDifference(endTime.getTime() - currentTime.getTime());

  const startDateStr = startTime.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `Started ${startDateStr} • ${timeRemaining} remaining`;
}