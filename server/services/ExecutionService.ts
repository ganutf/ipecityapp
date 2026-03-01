/**
 * ExecutionService - pulse execution recording and retrieval
 * Extracted from server/routes.ts (lines ~1147-1269)
 */

import type { IStorage } from '../storage';
import type { PulseExecution, Attestation, Pulse } from '@shared/schema';
import { ValidationError } from '../lib/errors';
import logger from '../logger';

interface PulseExecutionActions {
  liked: boolean;
  shared: boolean;
  abstained: boolean;
}

interface ExecutionDetailItem {
  execution: {
    id: number;
    actions: PulseExecutionActions;
    executedAt: Date | null;
  };
  pulse: {
    id: number;
    description: string;
    points: number;
    datetimeStart: Date;
    interval: number;
    urlEmbed: string;
  };
  attestation: {
    id: number;
    status: string;
    attestationUid: string | null;
    transactionHash: string | null;
    createdAt: Date | null;
  } | null;
  pointsEarned: number;
}

interface RecordExecutionResult {
  success: boolean;
  execution: PulseExecution | null;
  updated?: boolean;
  deleted?: boolean;
}

export class ExecutionService {
  constructor(private storage: IStorage) {}

  async getMemberExecutionDetails(memberId: number): Promise<ExecutionDetailItem[]> {
    const executionDetails = await this.storage.getMemberExecutionsWithDetails(memberId);

    return executionDetails.map(({ execution, pulse, attestation }) => ({
      execution: {
        id: execution.id,
        actions: execution.actions as PulseExecutionActions,
        executedAt: execution.executedAt,
      },
      pulse: {
        id: pulse.id,
        description: pulse.description,
        points: pulse.points,
        datetimeStart: pulse.datetimeStart,
        interval: pulse.interval,
        urlEmbed: pulse.urlEmbed,
      },
      attestation: attestation
        ? {
            id: attestation.id,
            status: attestation.status,
            attestationUid: attestation.attestationUid,
            transactionHash: attestation.transactionHash,
            createdAt: attestation.createdAt,
          }
        : null,
      pointsEarned: pulse.points,
    }));
  }

  async getMemberExecutions(memberId: number): Promise<PulseExecution[]> {
    if (isNaN(memberId)) {
      throw new Error('Invalid member ID');
    }
    return this.storage.getMemberExecutions(memberId);
  }

  async recordExecution(
    memberId: number,
    pulseId: number,
    actions: PulseExecutionActions,
  ): Promise<RecordExecutionResult> {
    logger.debug('Processing execution request', { memberId, pulseId, actions });

    const existingExecution = await this.storage.getPulseExecution(pulseId, memberId);

    if (existingExecution) {
      // All actions false → delete (cancel abstain)
      if (!actions.liked && !actions.shared && !actions.abstained) {
        await this.storage.deletePulseExecution(existingExecution.id);
        return { success: true, execution: null, deleted: true };
      }
      // Update existing execution
      const execution = await this.storage.updatePulseExecution(existingExecution.id, actions);
      return { success: true, execution, updated: true };
    }

    // New execution — require at least one action
    if (!actions.liked && !actions.shared && !actions.abstained) {
      throw new ValidationError('At least one action must be taken when creating a new execution');
    }

    const execution = await this.storage.createPulseExecution({
      pulseId,
      memberId,
      actions,
    });
    return { success: true, execution, updated: false };
  }
}
