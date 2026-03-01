/**
 * AttestationService - EAS attestation creation and management
 * Extracted from server/routes.ts (lines ~725-1144)
 */

import type { IStorage } from '../storage';
import type { Attestation, Member, Pulse, PulseExecution } from '@shared/schema';
import { getCurrentUTC, calculatePulseEndTimeUTC } from '@shared/pulseUtils';
import { withTimeout } from '../lib/rateLimiter';
import { ForbiddenError, NotFoundError } from '../lib/errors';
import { EAS_CONSTANTS } from '@shared/constants';
import logger from '../logger';

interface BulkAttestationResult {
  message: string;
  processed: number;
  successful: number;
  failed: number;
  errors?: string[];
}

interface SingleAttestationResult {
  message: string;
  attestation: {
    id: number;
    status: string;
    attestationUid: string | null;
    transactionHash: string | null;
  };
}

interface AttestationStatusResponse {
  exists: boolean;
  status: string;
  attestationUid?: string | null;
  transactionHash?: string | null;
  createdAt?: Date | null;
  message?: string;
}

interface PulseExecutionItem {
  member: {
    id: number;
    farcasterFid: number | null;
    ipePassport: string | null;
    ipeUsername: string | null;
    memberType: string | null;
  };
  execution: {
    id: number;
    actions: unknown;
    executedAt: Date | null;
    points: number;
  } | null;
  attestation: {
    id: number;
    status: string;
    attestationUid: string | null;
    transactionHash: string | null;
    createdAt: Date | null;
  } | null;
}

export class AttestationService {
  constructor(private storage: IStorage) {}

  private async getEasService() {
    const { easService } = await import('../lib/easService');
    return easService;
  }

  async getAttestationStatus(
    pulseExecutionId: number,
    requestingMemberId: number,
  ): Promise<AttestationStatusResponse> {
    if (isNaN(pulseExecutionId)) {
      throw new Error('Invalid pulse execution ID');
    }

    // Verify ownership
    const isOwner = await this.storage.verifyPulseExecutionOwnership(
      pulseExecutionId,
      requestingMemberId,
    );
    if (!isOwner) {
      throw new ForbiddenError(
        'Access denied. You can only view attestations for your own pulse executions.',
      );
    }

    const attestation = await this.storage.getAttestation(pulseExecutionId);
    if (!attestation) {
      return {
        exists: false,
        status: 'not_created',
        message: 'No attestation found for this pulse execution',
      };
    }

    return {
      exists: true,
      status: attestation.status,
      attestationUid: attestation.attestationUid,
      transactionHash: attestation.transactionHash,
      createdAt: attestation.createdAt,
    };
  }

  async getPendingAttestations() {
    const pendingAttestations = await this.storage.getPendingAttestations();
    return {
      count: pendingAttestations.length,
      attestations: pendingAttestations,
    };
  }

  async getPulseExecutionsWithAttestations(pulseId: number): Promise<{
    pulse: Pulse;
    executions: PulseExecutionItem[];
  }> {
    if (isNaN(pulseId)) {
      throw new Error('Invalid pulse ID');
    }

    const pulse = await this.storage.getPulse(pulseId);
    if (!pulse) {
      throw new NotFoundError('Pulse not found');
    }

    const executionsWithAttestations =
      await this.storage.getPulseExecutionsWithAttestations(pulseId);

    return {
      pulse,
      executions: executionsWithAttestations.map(({ execution, member, attestation }) => ({
        member: {
          id: member.id,
          farcasterFid: member.farcasterFid,
          ipePassport: member.ipePassport,
          ipeUsername: member.ipeUsername,
          memberType: member.memberType,
        },
        execution: execution
          ? {
              id: execution.id,
              actions: execution.actions,
              executedAt: execution.executedAt,
              points: pulse.points,
            }
          : null,
        attestation: attestation
          ? {
              id: attestation.id,
              status: attestation.status,
              attestationUid: attestation.attestationUid,
              transactionHash: attestation.transactionHash,
              createdAt: attestation.createdAt,
            }
          : null,
      })),
    };
  }

  async createBulkAttestations(pulseId: number): Promise<BulkAttestationResult> {
    logger.info(`[BULK_ATTESTATION] Starting bulk attestation creation for pulse ${pulseId}`);

    if (isNaN(pulseId) || pulseId <= 0) {
      throw new Error('Invalid pulse ID: must be a positive integer');
    }

    const pulse = await this.storage.getPulse(pulseId);
    if (!pulse) {
      throw new NotFoundError('Pulse not found');
    }

    // Validate pulse has ended
    const nowUTC = getCurrentUTC();
    const pulseEndTimeUTC = calculatePulseEndTimeUTC(pulse.datetimeStart, pulse.interval);
    logger.info(`[BULK_ATTESTATION] UTC Pulse timing - Now: ${nowUTC.toISOString()}, End: ${pulseEndTimeUTC.toISOString()}`);

    if (pulseEndTimeUTC > nowUTC) {
      throw new PulseActiveError(
        'Cannot create attestations for active pulse',
        pulseEndTimeUTC,
      );
    }

    // Get pending attestations for this pulse
    const pendingAttestations = await this.storage.getPendingAttestationsByPulse(pulseId);
    logger.info(`[BULK_ATTESTATION] Found ${pendingAttestations.length} pending attestations`);

    if (pendingAttestations.length === 0) {
      return {
        message: 'No pending attestations found for this pulse',
        processed: 0,
        successful: 0,
        failed: 0,
      };
    }

    const easService = await this.getEasService();

    // Filter out already-completed attestations
    const attestationDataList = [];
    for (const { execution, member, pulse: p } of pendingAttestations) {
      const existingAttestation = await this.storage.getAttestation(execution.id);
      if (!existingAttestation || existingAttestation.status !== 'completed') {
        attestationDataList.push({
          pulseExecutionId: execution.id,
          status: 'pending' as const,
          execution,
          member,
          pulse: p,
        });
      }
    }

    logger.info(`[BULK_ATTESTATION] Prepared ${attestationDataList.length} attestations for processing`);

    // Create DB records atomically
    const attestationResults = await this.storage.createBulkAttestationsWithTransaction(
      attestationDataList.map((data) => ({
        pulseExecutionId: data.pulseExecutionId,
        status: data.status,
      })),
    );

    logger.info(
      `[BULK_ATTESTATION] DB results: ${attestationResults.successful.length} successful, ${attestationResults.failed.length} failed`,
    );

    // Process EAS attestations
    let successful = 0;
    let failed = attestationResults.failed.length;
    const errors: string[] = attestationResults.failed.map((f) => f.error);

    for (const attestation of attestationResults.successful) {
      const attestationData = attestationDataList.find(
        (d) => d.pulseExecutionId === attestation.pulseExecutionId,
      );
      if (!attestationData) continue;

      try {
        const attestationResult = await withTimeout(
          easService.createAttestation({
            memberOnchainID: attestationData.member.ipePassport!,
            memberWalletAddress: attestationData.member.walletAddress!,
            pulseNumber: attestationData.pulse.id,
            executedAt: attestationData.execution.executedAt
              ? Math.floor(new Date(attestationData.execution.executedAt).getTime() / 1000)
              : Math.floor(getCurrentUTC().getTime() / 1000),
            actionsExecuted: JSON.stringify(attestationData.execution.actions),
          }),
          EAS_CONSTANTS.ATTESTATION_TIMEOUT_MS,
          'EAS Attestation Creation',
        );

        await this.storage.updateAttestationStatus(
          attestation.id,
          'completed',
          attestationResult.attestationUID,
          attestationResult.transactionHash,
        );
        successful++;
      } catch (error) {
        logger.error(
          `[BULK_ATTESTATION] Failed for member ${attestationData.member.ipePassport}:`,
          error,
        );
        failed++;
        errors.push(
          `Member ${attestationData.member.ipePassport}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );

        try {
          await this.storage.updateAttestationStatus(attestation.id, 'failed');
        } catch (updateError) {
          logger.error('Failed to update attestation status to failed:', updateError);
        }
      }
    }

    const totalProcessed = attestationDataList.length;
    logger.info(
      `[BULK_ATTESTATION] Completed: ${successful} successful, ${failed} failed out of ${totalProcessed}`,
    );

    return {
      message: `Processed ${totalProcessed} attestations for pulse ${pulseId}`,
      processed: totalProcessed,
      successful,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async createSingleAttestation(executionId: number): Promise<SingleAttestationResult> {
    if (isNaN(executionId) || executionId <= 0) {
      throw new Error('Invalid execution ID: must be a positive integer');
    }

    // Get execution with joined member + pulse via storage (no direct DB access)
    const executionData = await this.storage.getExecutionWithMemberAndPulse(executionId);
    if (!executionData) {
      throw new NotFoundError(
        `Pulse execution not found. No pulse execution found with ID ${executionId}.`,
      );
    }

    // Check member eligibility
    const { member } = executionData;
    if (
      member.status !== 'active_member' ||
      !member.passportVerified ||
      !member.ipePassport ||
      !member.walletAddress
    ) {
      throw new Error('Member is not eligible for attestations');
    }

    // Validate pulse has ended
    const nowUTC = getCurrentUTC();
    const pulseEndTimeUTC = calculatePulseEndTimeUTC(
      executionData.pulse.datetimeStart,
      executionData.pulse.interval,
    );
    if (pulseEndTimeUTC > nowUTC) {
      const timeUntilEnd = Math.ceil(
        (pulseEndTimeUTC.getTime() - nowUTC.getTime()) / (1000 * 60),
      );
      const hours = Math.floor(timeUntilEnd / 60);
      const minutes = timeUntilEnd % 60;
      const timeString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      throw new PulseActiveError(
        `Cannot create attestations for active pulse. Pulse ends at ${pulseEndTimeUTC.toISOString()} UTC. Time remaining: ${timeString}`,
        pulseEndTimeUTC,
      );
    }

    // Validate execution data
    if (!executionData.execution.actions || typeof executionData.execution.actions !== 'object') {
      throw new Error('Invalid execution data: missing or malformed actions');
    }

    // Create or get attestation record atomically
    let pendingAttestation = await this.storage.getAttestation(executionId);

    if (!pendingAttestation) {
      try {
        pendingAttestation = await this.storage.createAttestationWithTransaction({
          pulseExecutionId: executionId,
          status: 'pending',
        });
      } catch (error) {
        pendingAttestation = await this.storage.getAttestation(executionId);
        if (!pendingAttestation) {
          throw error;
        }
      }
    }

    if (pendingAttestation.status === 'completed') {
      return {
        message: 'Attestation already completed',
        attestation: {
          id: pendingAttestation.id,
          status: pendingAttestation.status,
          attestationUid: pendingAttestation.attestationUid,
          transactionHash: pendingAttestation.transactionHash,
        },
      };
    }

    // Create on-chain EAS attestation
    const easService = await this.getEasService();

    try {
      const attestationResult = await withTimeout(
        easService.createAttestation({
          memberOnchainID: member.ipePassport!,
          memberWalletAddress: member.walletAddress!,
          pulseNumber: executionData.pulse.id,
          executedAt: executionData.execution.executedAt
            ? Math.floor(new Date(executionData.execution.executedAt).getTime() / 1000)
            : Math.floor(getCurrentUTC().getTime() / 1000),
          actionsExecuted: JSON.stringify(executionData.execution.actions),
        }),
        EAS_CONSTANTS.ATTESTATION_TIMEOUT_MS,
        'EAS Attestation Creation',
      );

      const updatedAttestation = await this.storage.updateAttestationStatus(
        pendingAttestation.id,
        'completed',
        attestationResult.attestationUID,
        attestationResult.transactionHash,
      );

      return {
        message: 'Attestation created successfully',
        attestation: {
          id: updatedAttestation.id,
          status: updatedAttestation.status,
          attestationUid: updatedAttestation.attestationUid,
          transactionHash: updatedAttestation.transactionHash,
        },
      };
    } catch (err) {
      // Mark as failed
      try {
        await this.storage.updateAttestationStatus(pendingAttestation.id, 'failed');
      } catch (updateError) {
        logger.error('Failed to update attestation status to failed:', updateError);
      }
      throw err;
    }
  }
}

// Re-export shared error classes for backward compatibility with route imports
export { ForbiddenError, NotFoundError } from '../lib/errors';

export class PulseActiveError extends Error {
  constructor(
    message: string,
    public pulseEndTime: Date,
  ) {
    super(message);
    this.name = 'PulseActiveError';
  }
}
