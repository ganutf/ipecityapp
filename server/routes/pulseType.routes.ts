/**
 * V2 Pulse Type Routes
 * Mounted at /api/v2/pulse-types
 */

import { Router, Response } from 'express';
import {
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2,
  type PrivyAuthRequest,
} from '../middleware/privyAuth';
import { validateRequest } from '../middleware/validation';
import { storage } from '../storage';
import { insertPulseTypeSchema } from '@shared/schema';
import { getErrorMessage } from '../lib/errors';
import logger from '../logger';

const router = Router();

/** GET /api/v2/pulse-types */
router.get('/', async (req, res) => {
  try {
    const pulseTypes = await storage.getAllPulseTypes();
    res.json({ pulseTypes });
  } catch (err) {
    logger.error('Get pulse types error:', err);
    res.status(500).json({ error: getErrorMessage(err) || 'Failed to get pulse types' });
  }
});

/** POST /api/v2/pulse-types */
router.post(
  '/',
  privyAuthMiddleware,
  requireAdminV2,
  auditLoggerV2('CREATE_PULSE_TYPE'),
  validateRequest(insertPulseTypeSchema),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const pulseType = await storage.createPulseType(req.body);
      res.status(201).json(pulseType);
    } catch (err) {
      logger.error('Create pulse type error:', err);
      res.status(500).json({ error: getErrorMessage(err) || 'Failed to create pulse type' });
    }
  },
);

export default router;
