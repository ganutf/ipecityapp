/**
 * Shared utilities for pulse status determination and execution tracking
 * This ensures consistent logic across all components displaying pulse status
 */

export interface ExecutionStatus {
  liked: boolean;
  shared: boolean;
  abstained: boolean;
  hasExecution?: boolean;
}

export interface PulseTimingInfo {
  status: 'active' | 'ended' | 'future';
  isActive: boolean;
  isEnded: boolean;
  isFuture: boolean;
}

/**
 * Determines if a pulse has been executed by the user
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
 * Gets the timing status of a pulse based on start time and interval
 */
export function getPulseTimingInfo(
  datetimeStart: string | Date,
  interval: number,
  currentTime: Date = new Date()
): PulseTimingInfo {
  const startTime = new Date(datetimeStart);
  const endTime = new Date(startTime.getTime() + (interval * 60 * 60 * 1000));

  const isEnded = currentTime > endTime;
  const isActive = currentTime >= startTime && currentTime <= endTime;
  const isFuture = currentTime < startTime;

  return {
    status: isEnded ? 'ended' : isActive ? 'active' : 'future',
    isActive,
    isEnded,
    isFuture
  };
}

/**
 * Gets the appropriate card accent border color based on execution and timing status
 */
export function getCardAccentColor(
  executionStatus?: ExecutionStatus | null,
  datetimeStart?: string | Date,
  interval?: number
): string {
  // If user has executed, always show green
  if (hasUserExecuted(executionStatus)) {
    return "border-l-green-500";
  }

  // If timing info is available, use timing-based colors
  if (datetimeStart && interval) {
    const timingInfo = getPulseTimingInfo(datetimeStart, interval);
    
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
 */
export function getStatusBadge(
  executionStatus?: ExecutionStatus | null,
  datetimeStart?: string | Date,
  interval?: number
): { className: string; text: string } | null {
  const baseClasses = "px-3 py-1.5 text-sm font-semibold rounded-full";

  // If timing info is available, determine status
  if (datetimeStart && interval) {
    const timingInfo = getPulseTimingInfo(datetimeStart, interval);
    
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