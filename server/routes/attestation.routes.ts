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
import { AttestationService, PulseActiveError } from '../services/AttestationService';
import { attestationRateLimit, bulkAttestationRateLimit } from '../lib/rateLimiter';
import { storage } from '../storage';
import { parseIntParam, handleServiceError } from '../lib/routeHelpers';

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
      handleServiceError(err, res, 'Failed to get pending attestations');
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
      const pulseExecutionId = parseIntParam(req, 'pulseExecutionId');
      const result = await attestationService.getAttestationStatus(
        pulseExecutionId,
        req.member.id,
      );
      res.json(result);
    } catch (err) {
      handleServiceError(err, res, 'Failed to get attestation status');
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
      const pulseId = parseIntParam(req, 'pulseId');
      const result = await attestationService.createBulkAttestations(pulseId);
      res.json(result);
    } catch (err) {
      if (err instanceof PulseActiveError) {
        return res.status(400).json({
          error: err.message,
          details: `Pulse ends at ${err.pulseEndTime.toISOString()} UTC`,
        });
      }
      handleServiceError(err, res, 'Failed to create pulse attestations');
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
      const executionId = parseIntParam(req, 'executionId');
      const result = await attestationService.createSingleAttestation(executionId);
      res.json(result);
    } catch (err) {
      if (err instanceof PulseActiveError) {
        return res.status(400).json({
          error: err.message,
          pulseEndTime: err.pulseEndTime.toISOString(),
        });
      }
      handleServiceError(err, res, 'Failed to create attestation');
    }
  },
);

export default router;
