/**
 * V2 Passport Routes — username availability and ENS lookup
 * Mounted at /api/v2/passport
 */

import { Router } from 'express';
import { PassportService } from '../services/PassportService';
import { storage } from '../storage';
import logger from '../logger';

const router = Router();

const passportService = new PassportService(
  storage,
  process.env.JUSTANAME_API_KEY || '',
);

/** GET /api/v2/passport/availability/:username */
router.get('/availability/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const result = await passportService.checkUsernameAvailability(username);
    res.json(result);
  } catch (err) {
    if (err instanceof Error && (err.message.includes('at least 3') || err.message.includes('letters and numbers'))) {
      return res.status(400).json({ error: err.message });
    }
    logger.error('Username availability check error:', err);
    res.status(500).json({ error: 'Failed to check username availability' });
  }
});

/** GET /api/v2/passport/ens/lookup/:address */
router.get('/ens/lookup/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const result = await passportService.lookupEns(address);
    res.json(result);
  } catch (err) {
    logger.error('ENS lookup route error:', err);
    res.status(500).json({
      ensName: null,
      source: 'justaname',
      error: 'Internal server error',
    });
  }
});

export default router;
