/**
 * V2 Execution Routes — record and retrieve pulse executions
 * Mounted at /api/v2/executions
 */

import { Router, Response } from 'express';
import {
  privyAuthMiddleware,
  requireOwnershipV2,
  type PrivyAuthRequest,
} from '../middleware/privyAuth';
import { validateRequest } from '../middleware/validation';
import { ExecutionService } from '../services/ExecutionService';
import { storage } from '../storage';
import { getErrorMessage } from '../lib/errors';
import { z } from 'zod';
import logger from '../logger';

const router = Router();

const executionService = new ExecutionService(storage);

/** GET /api/v2/executions/:memberId */
router.get(
  '/:memberId',
  privyAuthMiddleware,
  requireOwnershipV2('memberId'),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const memberId = parseInt(req.params.memberId);
      const executions = await executionService.getMemberExecutions(memberId);
      res.json({ executions });
    } catch (err) {
      logger.error('Get executions error:', err);
      res.status(500).json({ error: getErrorMessage(err) || 'Failed to get executions' });
    }
  },
);

/** GET /api/v2/executions/:memberId/details */
router.get(
  '/:memberId/details',
  privyAuthMiddleware,
  requireOwnershipV2('memberId'),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const memberId = parseInt(req.params.memberId);
      const executionDetails = await executionService.getMemberExecutionDetails(memberId);
      res.json({ executionDetails });
    } catch (err) {
      logger.error('Get execution details error:', err);
      res.status(500).json({ error: getErrorMessage(err) || 'Failed to get execution details' });
    }
  },
);

/** POST /api/v2/executions */
router.post(
  '/',
  privyAuthMiddleware,
  validateRequest(
    z.object({
      pulseId: z.number().int().positive(),
      actions: z.object({
        liked: z.boolean(),
        shared: z.boolean(),
        abstained: z.boolean(),
      }),
    }),
  ),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      if (!req.member) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { pulseId, actions } = req.body;
      const result = await executionService.recordExecution(req.member.id, pulseId, actions);
      res.json(result);
    } catch (err) {
      if (err instanceof Error && err.message.includes('At least one action')) {
        return res.status(400).json({ error: 'Validation failed', message: err.message });
      }
      logger.error('Create/update execution error:', err);
      res.status(500).json({ error: getErrorMessage(err) || 'Failed to record execution' });
    }
  },
);

export default router;
