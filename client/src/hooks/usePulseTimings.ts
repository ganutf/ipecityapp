import { useState, useEffect } from "react";
import { getPulseTimingInfo } from "../lib/pulseUtils";

export interface Pulse {
  id: number;
  description: string;
  points: number;
  datetimeStart: string;
  interval: number;
}

export type PulseStatus = 'future' | 'active' | 'ended';

export interface PulseTimingInfo {
  pulse: Pulse;
  status: PulseStatus;
  startTime: Date;
  endTime: Date;
  timeUntilStart: string | null;
  timeUntilEnd: string | null;
  isEnded: boolean;
  isActive: boolean;
  isFuture: boolean;
}

/**
 * Custom hook for calculating pulse timing information
 * Provides real-time updates for countdowns and pulse status
 */
export function usePulseTimings(pulses: Pulse[], enableRealTime: boolean = true): {
  pulseTimings: PulseTimingInfo[];
  activePulses: PulseTimingInfo[];
  futurePulses: PulseTimingInfo[];
  endedPulses: PulseTimingInfo[];
} {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute for real-time countdowns
  useEffect(() => {
    if (!enableRealTime) return;
    
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [enableRealTime]);

  const calculatePulseTimings = (pulses: Pulse[], now: Date): PulseTimingInfo[] => {
    return pulses.map(pulse => {
      // Use shared timing logic
      const timingInfo = getPulseTimingInfo(pulse.datetimeStart, pulse.interval, now);
      
      const startTime = new Date(pulse.datetimeStart);
      const endTime = new Date(startTime.getTime() + (pulse.interval * 60 * 60 * 1000));

      const timeUntilStart = timingInfo.isFuture ? formatTimeDifference(startTime.getTime() - now.getTime()) : null;
      const timeUntilEnd = timingInfo.isActive ? formatTimeDifference(endTime.getTime() - now.getTime()) : null;

      return {
        pulse,
        status: timingInfo.status,
        startTime,
        endTime,
        timeUntilStart,
        timeUntilEnd,
        isEnded: timingInfo.isEnded,
        isActive: timingInfo.isActive,
        isFuture: timingInfo.isFuture,
      };
    });
  };

  const formatTimeDifference = (diffMs: number): string => {
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

  const pulseTimings = calculatePulseTimings(pulses || [], currentTime);
  
  const activePulses = pulseTimings.filter(pt => pt.isActive);
  const futurePulses = pulseTimings.filter(pt => pt.isFuture).sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );
  const endedPulses = pulseTimings.filter(pt => pt.isEnded).sort(
    (a, b) => b.endTime.getTime() - a.endTime.getTime()
  );

  return {
    pulseTimings,
    activePulses,
    futurePulses,
    endedPulses,
  };
}