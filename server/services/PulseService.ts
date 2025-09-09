/**
 * PulseService - orchestrates pulse-related business operations
 * This service layer sits between the routes (controllers) and storage (data layer)
 * It handles business logic while delegating data operations to storage
 */

import { Pulse, type PulseData } from '../domain/Pulse';
import type { IStorage } from '../storage';
import { getCurrentUTC } from '@shared/pulseUtils';

export class PulseService {
  constructor(private storage: IStorage) {}

  /**
   * Calculate pulse streak for a member using domain business logic
   * @param memberId - The member ID to calculate streak for
   * @param currentTime - Current UTC time, defaults to now
   */
  async calculateMemberStreak(memberId: number, currentTime: Date = getCurrentUTC()): Promise<number> {
    try {
      // Validate input
      if (!memberId || memberId <= 0) {
        throw new Error(`Invalid memberId: ${memberId}`);
      }

      // Get all pulses with execution status for this member
      const pulseResults = await this.storage.getPulsesWithExecutionStatus(memberId);
      
      if (pulseResults.length === 0) return 0;

      let streak = 0;
    
    for (let i = 0; i < pulseResults.length; i++) {
      const result = pulseResults[i];
      const isExecuted = result.executionId !== null;
      
      // Validate pulse data before creating domain object
      if (!result.datetimeStart || result.interval <= 0) {
        console.warn(`Invalid pulse data for pulse ${result.pulseId}: start=${result.datetimeStart}, interval=${result.interval}`);
        continue; // Skip invalid pulses
      }

      // Create Pulse domain object to handle business logic
      const pulse = new Pulse({
        id: result.pulseId,
        urlEmbed: '', // Not needed for streak calculation
        datetimeStart: result.datetimeStart,
        interval: result.interval,
        description: '', // Not needed for streak calculation
        points: 0, // Not needed for streak calculation
        pulseTypeId: 0, // Not needed for streak calculation
        createdBy: 0, // Not needed for streak calculation
        createdAt: null // Not needed for streak calculation
      });

      // Special handling for the most recent pulse (first in the list)
      if (i === 0 && pulse.isActive(currentTime) && !isExecuted) {
        // Most recent pulse is active but not executed - skip it, don't break streak
        continue;
      }
      
      // Use domain logic for all pulses
      if (pulse.shouldCountInStreak(isExecuted, currentTime)) {
        streak++;
      } else if (pulse.shouldBreakStreak(isExecuted, currentTime)) {
        break;
      }
    }

    return streak;
    } catch (error) {
      console.error(`Error calculating pulse streak for member ${memberId}:`, error);
      // Return 0 on error to avoid breaking the application
      return 0;
    }
  }

  /**
   * Get pulse with its current status and timing information
   * @param pulseId - The pulse ID
   * @param currentTime - Current UTC time, defaults to now
   */
  async getPulseWithStatus(pulseId: number, currentTime: Date = getCurrentUTC()): Promise<Pulse | null> {
    const pulseData = await this.storage.getPulse(pulseId);
    if (!pulseData) return null;

    return new Pulse(pulseData as PulseData);
  }

  /**
   * Get all pulses with their current status
   * @param currentTime - Current UTC time, defaults to now
   */
  async getAllPulsesWithStatus(currentTime: Date = getCurrentUTC()): Promise<Pulse[]> {
    const pulsesData = await this.storage.getAllPulses();
    return pulsesData.map(data => new Pulse(data as PulseData));
  }

  /**
   * Get only active pulses
   * @param currentTime - Current UTC time, defaults to now
   */
  async getActivePulses(currentTime: Date = getCurrentUTC()): Promise<Pulse[]> {
    const allPulses = await this.getAllPulsesWithStatus(currentTime);
    return allPulses.filter(pulse => pulse.isActive(currentTime));
  }

  /**
   * Check if a specific pulse is currently active
   * @param pulseId - The pulse ID to check
   * @param currentTime - Current UTC time, defaults to now
   */
  async isPulseActive(pulseId: number, currentTime: Date = getCurrentUTC()): Promise<boolean> {
    const pulse = await this.getPulseWithStatus(pulseId, currentTime);
    return pulse ? pulse.isActive(currentTime) : false;
  }

  /**
   * Get pulse execution status for a member and specific pulse
   * @param pulseId - The pulse ID
   * @param memberId - The member ID
   */
  async getPulseExecutionStatus(pulseId: number, memberId: number) {
    return await this.storage.getPulseExecution(pulseId, memberId);
  }

  /**
   * Create a new pulse (delegates to storage but could add validation)
   * @param pulseData - The pulse data to create
   */
  async createPulse(pulseData: Omit<PulseData, 'id' | 'createdAt'>) {
    return await this.storage.createPulse(pulseData);
  }

  /**
   * Update a pulse (delegates to storage but could add validation)
   * @param pulseId - The pulse ID to update
   * @param updateData - The data to update
   */
  async updatePulse(pulseId: number, updateData: Partial<Omit<PulseData, 'id' | 'createdAt'>>) {
    return await this.storage.updatePulse(pulseId, updateData);
  }

  /**
   * Delete a pulse (delegates to storage but could add business rules)
   * @param pulseId - The pulse ID to delete
   */
  async deletePulse(pulseId: number) {
    return await this.storage.deletePulse(pulseId);
  }
}