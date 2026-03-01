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
import { AttestationService, NotFoundError } from '../services/AttestationService';
import { storage } from '../storage';
import { insertPulseSchema, updatePulseSchema } from '@shared/schema';
import { getErrorMessage } from '../lib/errors';
import logger from '../logger';

const router = Router();

const pulseService = new PulseService(storage);
const attestationService = new AttestationService(storage);

/** GET /api/v2/pulses */
router.get('/', async (req, res) => {
  try {
    const pulses = await storage.getAllPulses();
    res.json({ pulses });
  } catch (err) {
    logger.error('Get pulses error:', err);
    res.status(500).json({ error: getErrorMessage(err) || 'Failed to get pulses' });
  }
});

/** GET /api/v2/pulses/active */
router.get('/active', async (req, res) => {
  try {
    const pulses = await storage.getActivePulses();
    res.json({ pulses });
  } catch (err) {
    logger.error('Active pulses error:', err);
    res.status(500).json({ error: getErrorMessage(err) || 'Failed to get active pulses' });
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
      logger.error('Create pulse error:', err);
      res.status(500).json({ error: getErrorMessage(err) || 'Failed to create pulse' });
    }
  },
);

/** PATCH /api/v2/pulses/:id */
router.patch(
  '/:id',
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2('UPDATE_PULSE'),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid pulse ID' });
      }
      const pulse = await pulseService.updatePulse(id, req.body);
      res.json(pulse);
    } catch (err) {
      logger.error('Update pulse error:', err);
      res.status(500).json({ error: getErrorMessage(err) || 'Failed to update pulse' });
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
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid pulse ID' });
      }
      await pulseService.deletePulse(id);
      res.json({ success: true });
    } catch (err) {
      logger.error('Delete pulse error:', err);
      res.status(500).json({ error: getErrorMessage(err) || 'Failed to delete pulse' });
    }
  },
);

/** GET /api/v2/pulses/:pulseId/executions */
router.get(
  '/:pulseId/executions',
  privyAuthMiddleware,
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const pulseId = parseInt(req.params.pulseId);
      if (isNaN(pulseId)) {
        return res.status(400).json({ error: 'Invalid pulse ID' });
      }
      const result = await attestationService.getPulseExecutionsWithAttestations(pulseId);
      res.json(result);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      logger.error('Get pulse executions error:', err);
      res.status(500).json({ error: getErrorMessage(err) || 'Failed to get pulse executions' });
    }
  },
);

export default router;
