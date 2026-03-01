/**
 * V2 Pulse Routes — CRUD and execution queries
 * Mounted at /api/v2/pulses
 */

import { Router, Response } from 'express';
import {
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2,
  type PrivyAuthRequest,
} from '../middleware/privyAuth';
import { validateRequest } from '../middleware/validation';
import { PulseService } from '../services/PulseService';
import { AttestationService } from '../services/AttestationService';
import { storage } from '../storage';
import { insertPulseSchema, updatePulseSchema } from '@shared/schema';
import { parseIntParam, handleServiceError } from '../lib/routeHelpers';

const router = Router();

const pulseService = new PulseService(storage);
const attestationService = new AttestationService(storage);

/** GET /api/v2/pulses */
router.get('/', async (req, res) => {
  try {
    const pulses = await storage.getAllPulses();
    res.json({ pulses });
  } catch (err) {
    handleServiceError(err, res, 'Failed to get pulses');
  }
});

/** GET /api/v2/pulses/active */
router.get('/active', async (req, res) => {
  try {
    const pulses = await storage.getActivePulses();
    res.json({ pulses });
  } catch (err) {
    handleServiceError(err, res, 'Failed to get active pulses');
  }
});

/** POST /api/v2/pulses */
router.post(
  '/',
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2('CREATE_PULSE'),
  validateRequest(insertPulseSchema),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const pulse = await pulseService.createPulse(req.body);
      res.status(201).json(pulse);
    } catch (err) {
      handleServiceError(err, res, 'Failed to create pulse');
    }
  },
);

/** PATCH /api/v2/pulses/:id */
router.patch(
  '/:id',
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2('UPDATE_PULSE'),
  validateRequest(updatePulseSchema),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const id = parseIntParam(req, 'id');
      const pulse = await pulseService.updatePulse(id, req.body);
      res.json(pulse);
    } catch (err) {
      handleServiceError(err, res, 'Failed to update pulse');
    }
  },
);

/** DELETE /api/v2/pulses/:id */
router.delete(
  '/:id',
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2('DELETE_PULSE'),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const id = parseIntParam(req, 'id');
      await pulseService.deletePulse(id);
      res.json({ success: true });
    } catch (err) {
      handleServiceError(err, res, 'Failed to delete pulse');
    }
  },
);

/** GET /api/v2/pulses/:pulseId/executions */
router.get(
  '/:pulseId/executions',
  privyAuthMiddleware,
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const pulseId = parseIntParam(req, 'pulseId');
      const result = await attestationService.getPulseExecutionsWithAttestations(pulseId);
      res.json(result);
    } catch (err) {
      handleServiceError(err, res, 'Failed to get pulse executions');
    }
  },
);

export default router;
