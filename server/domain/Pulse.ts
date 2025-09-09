/**
 * Pulse domain class - encapsulates all business logic related to pulses
 * This follows Domain-Driven Design principles by keeping business rules
 * separate from data persistence concerns
 */

import { getPulseTimingInfo, isPulseActive, calculatePulseEndTimeUTC, type PulseTimingInfo } from '@shared/pulseUtils';

export interface PulseData {
  id: number;
  urlEmbed: string;
  datetimeStart: Date;
  interval: number;
  description: string;
  points: number;
  pulseTypeId: number;
  createdBy: number;
  createdAt: Date | null;
}

export class Pulse {
  private readonly data: PulseData;

  constructor(pulseData: PulseData) {
    this.data = { ...pulseData };
  }

  // Getters for pulse data
  get id(): number { return this.data.id; }
  get urlEmbed(): string { return this.data.urlEmbed; }
  get datetimeStart(): Date { return this.data.datetimeStart; }
  get interval(): number { return this.data.interval; }
  get description(): string { return this.data.description; }
  get points(): number { return this.data.points; }
  get pulseTypeId(): number { return this.data.pulseTypeId; }
  get createdBy(): number { return this.data.createdBy; }
  get createdAt(): Date | null { return this.data.createdAt; }

  // Business logic methods

  /**
   * Check if this pulse is currently active (within its time window)
   * @param currentTime - Current UTC time, defaults to now
   */
  isActive(currentTime: Date = new Date()): boolean {
    return isPulseActive(this.data.datetimeStart, this.data.interval, currentTime);
  }

  /**
   * Check if this pulse has ended
   * @param currentTime - Current UTC time, defaults to now
   */
  hasEnded(currentTime: Date = new Date()): boolean {
    const timingInfo = this.getTimingInfo(currentTime);
    return timingInfo.isEnded;
  }

  /**
   * Check if this pulse is scheduled for the future
   * @param currentTime - Current UTC time, defaults to now
   */
  isFuture(currentTime: Date = new Date()): boolean {
    const timingInfo = this.getTimingInfo(currentTime);
    return timingInfo.isFuture;
  }

  /**
   * Get complete timing information for this pulse
   * @param currentTime - Current UTC time, defaults to now
   */
  getTimingInfo(currentTime: Date = new Date()): PulseTimingInfo {
    return getPulseTimingInfo(this.data.datetimeStart, this.data.interval, currentTime);
  }

  /**
   * Get the end time of this pulse in UTC
   */
  getEndTime(): Date {
    return calculatePulseEndTimeUTC(this.data.datetimeStart, this.data.interval);
  }

  /**
   * Get the status string for this pulse
   * @param currentTime - Current UTC time, defaults to now
   */
  getStatus(currentTime: Date = new Date()): 'active' | 'ended' | 'future' {
    return this.getTimingInfo(currentTime).status;
  }

  /**
   * Check if this pulse should be considered for streak calculation
   * @param isExecuted - Whether the user has executed this pulse
   * @param currentTime - Current UTC time, defaults to now
   * @returns true if this pulse should increment the streak count
   */
  shouldCountInStreak(isExecuted: boolean, currentTime: Date = new Date()): boolean {
    if (this.isActive(currentTime)) {
      // For active pulses, only count if executed
      return isExecuted;
    } else {
      // For ended pulses, only count if executed (will break streak if not executed)
      return isExecuted;
    }
  }

  /**
   * Check if this pulse should break the streak calculation
   * @param isExecuted - Whether the user has executed this pulse
   * @param currentTime - Current UTC time, defaults to now
   */
  shouldBreakStreak(isExecuted: boolean, currentTime: Date = new Date()): boolean {
    if (this.isActive(currentTime)) {
      // Active pulses never break the streak (they're either counted or skipped)
      return false;
    } else {
      // Ended pulses break the streak if not executed
      return !isExecuted;
    }
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON(): PulseData & { status: string; isActive: boolean; endTime: Date } {
    const timingInfo = this.getTimingInfo();
    return {
      ...this.data,
      status: timingInfo.status,
      isActive: timingInfo.isActive,
      endTime: this.getEndTime()
    };
  }
}