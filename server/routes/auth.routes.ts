import { Router, Request, Response } from 'express';
import { privyAuthMiddleware, optionalPrivyAuthMiddleware, PrivyAuthRequest } from '../middleware/privyAuth';
import { storage } from '../storage';
import logger from '../logger';

const router = Router();

/**
 * POST /api/v2/auth/login
 * Exchange Privy token for member data, creating member if needed
 */
router.post('/login', privyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id: privyId } = req.privyUser;
    const { email, walletAddress } = req.body;

    // Check if member already exists
    let member = await storage.getMemberByPrivyId(privyId);

    if (!member) {
      // Create new member from Privy data
      logger.info('Creating new member from Privy', {
        privyId,
        email,
        walletAddress,
      });

      member = await storage.createMemberFromPrivy(privyId, email, walletAddress);
    }

    res.json({
      isMember: true,
      status: member.status,
      member,
    });
  } catch (error) {
    logger.error('Error in /login', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to process login' });
  }
});

/**
 * GET /api/v2/auth/me
 * Get current user profile and member data
 */
router.get('/me', optionalPrivyAuthMiddleware, async (req: PrivyAuthRequest, res: Response) => {
  try {
    if (!req.privyUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const member = req.member;

    if (!member) {
      // User is authenticated but not a member yet
      return res.json({
        isMember: false,
        status: null,
        member: null,
        privyUser: {
          id: req.privyUser.id,
          email: req.privyUser.email,
          wallet: req.privyUser.wallet,
        },
      });
    }

    // Calculate stats if member exists
    let totalPoints = 0;
    let pulseStreak = 0;

    try {
      totalPoints = await storage.calculateTotalPoints(member.id);
      // Note: pulseService would need to be imported for streak calculation
      // pulseStreak = await pulseService.calculateMemberStreak(member.id);
    } catch (statsError) {
      logger.warn('Failed to calculate member stats', {
        memberId: member.id,
        error: statsError instanceof Error ? statsError.message : String(statsError),
      });
    }

    res.json({
      isMember: true,
      status: member.status,
      member: {
        ...member,
        totalPoints,
        pulseStreak,
      },
      privyUser: {
        id: req.privyUser.id,
        email: req.privyUser.email,
        wallet: req.privyUser.wallet,
      },
    });
  } catch (error) {
    logger.error('Error in /me', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

/**
 * POST /api/v2/auth/logout
 * Clear any server-side session data
 */
router.post('/logout', (req: Request, res: Response) => {
  // Privy handles token invalidation on the client side
  // This endpoint is for any server-side cleanup if needed
  res.json({ success: true });
});

export default router;
