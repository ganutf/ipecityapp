/**
 * V2 Attestation Routes — EAS attestation management
 * Mounted at /api/v2/attestations
 */

import { Router, Response } from 'express';
import {
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2,
  type PrivyAuthRequest,
} from '../middleware/privyAuth';
import {
  AttestationService,
  ForbiddenError,
  NotFoundError,
  PulseActiveError,
} from '../services/AttestationService';
import { attestationRateLimit, bulkAttestationRateLimit } from '../lib/rateLimiter';
import { storage } from '../storage';
import { getErrorMessage } from '../lib/errors';
import logger from '../logger';

const router = Router();

const attestationService = new AttestationService(storage);

/** GET /api/v2/attestations/pending */
router.get(
  '/pending',
  privyAuthMiddleware,
  requireAdminV2,
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const result = await attestationService.getPendingAttestations();
      res.json(result);
    } catch (err) {
      logger.error('Get pending attestations error:', err);
      res.status(500).json({ error: getErrorMessage(err) || 'Failed to get pending attestations' });
    }
  },
);

/** GET /api/v2/attestations/:pulseExecutionId */
router.get(
  '/:pulseExecutionId',
  privyAuthMiddleware,
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      if (!req.member) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const pulseExecutionId = parseInt(req.params.pulseExecutionId);
      if (isNaN(pulseExecutionId)) {
        return res.status(400).json({ error: 'Invalid pulse execution ID' });
      }
      const result = await attestationService.getAttestationStatus(
        pulseExecutionId,
        req.member.id,
      );
      res.json(result);
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return res.status(403).json({ error: err.message });
      }
      logger.error('Get attestation error:', err);
      res.status(500).json({ error: getErrorMessage(err) || 'Failed to get attestation status' });
    }
  },
);

/** POST /api/v2/attestations/pulse/:pulseId/create-all */
router.post(
  '/pulse/:pulseId/create-all',
  privyAuthMiddleware,
  requireAdminV2,
  bulkAttestationRateLimit.middleware(),
  auditLoggerV2('CREATE_ALL_PULSE_ATTESTATIONS'),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const pulseId = parseInt(req.params.pulseId);
      const result = await attestationService.createBulkAttestations(pulseId);
      res.json(result);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      if (err instanceof PulseActiveError) {
        return res.status(400).json({
          error: err.message,
          details: `Pulse ends at ${err.pulseEndTime.toISOString()} UTC`,
        });
      }
      logger.error('Bulk attestation creation error:', err);
      res.status(500).json({ error: getErrorMessage(err) || 'Failed to create pulse attestations' });
    }
  },
);

/** POST /api/v2/attestations/:executionId */
router.post(
  '/:executionId',
  privyAuthMiddleware,
  requireAdminV2,
  attestationRateLimit.middleware(),
  auditLoggerV2('CREATE_SINGLE_ATTESTATION'),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const executionId = parseInt(req.params.executionId);
      const result = await attestationService.createSingleAttestation(executionId);
      res.json(result);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      if (err instanceof PulseActiveError) {
        return res.status(400).json({
          error: err.message,
          pulseEndTime: err.pulseEndTime.toISOString(),
        });
      }
      logger.error('Create single attestation error:', err);
      res.status(500).json({ error: getErrorMessage(err) || 'Failed to create attestation' });
    }
  },
);

export default router;
