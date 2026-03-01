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
import { parseIntParam, handleServiceError } from '../lib/routeHelpers';
import { z } from 'zod';

const router = Router();

const executionService = new ExecutionService(storage);

/** GET /api/v2/executions/:memberId */
router.get(
  '/:memberId',
  privyAuthMiddleware,
  requireOwnershipV2('memberId'),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const memberId = parseIntParam(req, 'memberId');
      const executions = await executionService.getMemberExecutions(memberId);
      res.json({ executions });
    } catch (err) {
      handleServiceError(err, res, 'Failed to get executions');
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
      const memberId = parseIntParam(req, 'memberId');
      const executionDetails = await executionService.getMemberExecutionDetails(memberId);
      res.json({ executionDetails });
    } catch (err) {
      handleServiceError(err, res, 'Failed to get execution details');
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
      handleServiceError(err, res, 'Failed to record execution');
    }
  },
);

export default router;
