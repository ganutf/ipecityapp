/**
 * V2 Farcaster Routes — signer management + cast/reaction operations
 * Mounted at /api/v2/farcaster
 */

import { Router, Response } from 'express';
import {
  privyAuthMiddleware,
  optionalPrivyAuthMiddleware,
  type PrivyAuthRequest,
} from '../middleware/privyAuth';
import { validateRequest } from '../middleware/validation';
import {
  FarcasterService,
  SignerNotFoundError,
  StaleSignerError,
  RateLimitError,
} from '../services/FarcasterService';
import { storage } from '../storage';
import { getErrorStatus, getErrorMessage, getNeynarErrorData } from '../lib/errors';
import { z } from 'zod';
import logger from '../logger';

const router = Router();

const farcasterService = new FarcasterService(
  storage,
  process.env.NEYNAR_API_KEY || '',
);

/** GET /api/v2/farcaster/signer — get or create signer for authenticated member */
router.get(
  '/signer',
  privyAuthMiddleware,
  async (req: PrivyAuthRequest, res: Response) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    try {
      if (!req.member) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const result = await farcasterService.getOrCreateSigner(req.member.id);
      res.json(result);
    } catch (err) {
      if (err instanceof SignerNotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      if (err instanceof StaleSignerError) {
        return res.status(404).json({
          error: 'Stale signer found',
          message: err.message,
          action: 'refresh_required',
        });
      }
      if (err instanceof RateLimitError) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: err.message,
          retryAfter: err.retryAfter,
          action: 'wait_and_retry',
        });
      }
      logger.error('Signer endpoint error:', err);
      const msg = getNeynarErrorData(err) || getErrorMessage(err);
      res.status(getErrorStatus(err)).json({ error: msg });
    }
  },
);

/** POST /api/v2/farcaster/signer/check — check signer status */
router.post(
  '/signer/check',
  privyAuthMiddleware,
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      if (!req.member) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const result = await farcasterService.checkSignerStatus(req.member.id);
      res.json(result);
    } catch (err) {
      if (err instanceof SignerNotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      logger.error('Signer check error:', err);
      const msg = getNeynarErrorData(err) || getErrorMessage(err);
      res.status(getErrorStatus(err)).json({ error: msg });
    }
  },
);

/** POST /api/v2/farcaster/reaction */
router.post(
  '/reaction',
  privyAuthMiddleware,
  validateRequest(
    z.object({
      signer_uuid: z.string().uuid('Invalid signer UUID'),
      reaction_type: z.enum(['like', 'recast'], { required_error: 'Invalid reaction type' }),
      target: z.string().min(1, 'Target hash required').max(100, 'Target hash too long'),
    }),
  ),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const { signer_uuid, reaction_type, target } = req.body;
      const out = await farcasterService.publishReaction(signer_uuid, reaction_type, target);
      res.json(out);
    } catch (err) {
      const msg = getNeynarErrorData(err) || getErrorMessage(err);
      res.status(getErrorStatus(err)).json({ error: msg });
    }
  },
);

/** POST /api/v2/farcaster/cast */
router.post(
  '/cast',
  privyAuthMiddleware,
  validateRequest(
    z.object({
      signer_uuid: z.string().uuid('Invalid signer UUID'),
      text: z.string().max(320, 'Cast text too long').optional(),
      embeds: z.array(z.any()).max(10, 'Too many embeds').optional(),
    }),
  ),
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const { signer_uuid, text, embeds } = req.body;
      const out = await farcasterService.publishCast(signer_uuid, text, embeds);
      res.json(out);
    } catch (err) {
      const msg = getNeynarErrorData(err) || getErrorMessage(err);
      res.status(getErrorStatus(err)).json({ error: msg });
    }
  },
);

/** GET /api/v2/farcaster/cast/:hash/quotes — check if viewer quote-recast */
router.get(
  '/cast/:hash/quotes',
  optionalPrivyAuthMiddleware,
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const { hash } = req.params;
      const viewerFid = req.member?.farcasterFid;

      if (!viewerFid) {
        return res.json({ hasQuoted: false });
      }

      const hasQuoted = await farcasterService.checkQuoteRecast(hash, viewerFid);
      res.json({ hasQuoted });
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  },
);

/** GET /api/v2/farcaster/cast/:identifier — lookup cast with viewer context */
router.get(
  '/cast/:identifier',
  optionalPrivyAuthMiddleware,
  async (req: PrivyAuthRequest, res: Response) => {
    try {
      const { identifier } = req.params;
      const type = (req.query.type as 'hash' | 'url') ?? 'url';
      const viewerFid = req.member?.farcasterFid ?? 0;

      const out = await farcasterService.lookupCast(identifier, viewerFid, type);
      res.json(out);
    } catch (err) {
      logger.error('Cast lookup error:', err);
      const msg = getNeynarErrorData(err) || getErrorMessage(err);
      res.status(getErrorStatus(err)).json({ error: msg });
    }
  },
);

export default router;
