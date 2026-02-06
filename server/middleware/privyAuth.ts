import { Request, Response, NextFunction } from 'express';
import { privy } from '../lib/privy';
import { storage } from '../storage';
import type { Member } from '../../shared/schema';

export interface PrivyAuthRequest extends Request {
  privyUser?: {
    id: string;
    email?: string;
    wallet?: string;
  };
  member?: Member;
}

/**
 * Middleware to verify Privy access tokens and attach user/member to request
 *
 * Usage: app.get('/protected', privyAuthMiddleware, handler)
 */
export async function privyAuthMiddleware(
  req: PrivyAuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!privy) {
    // Privy not configured - skip authentication
    console.warn('Privy middleware called but Privy not configured');
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const token = authHeader.slice(7);

    // Verify the Privy access token
    const verifiedClaims = await privy.utils().auth().verifyAccessToken(token);

    // Try to find existing member by Privy ID first
    let member = await storage.getMemberByPrivyId(verifiedClaims.user_id);

    req.privyUser = {
      id: verifiedClaims.user_id,
      // Get email/wallet from member if available (avoids extra API call)
      email: member?.email ?? undefined,
      wallet: member?.walletAddress ?? undefined,
    };

    if (member) {
      req.member = member;
    }

    next();
  } catch (error) {
    console.error('Privy auth error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional Privy auth - doesn't fail if no token present
 * Useful for routes that work with or without authentication
 */
export async function optionalPrivyAuthMiddleware(
  req: PrivyAuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!privy) {
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(); // No token, but that's OK
    }

    const token = authHeader.slice(7);
    const verifiedClaims = await privy.utils().auth().verifyAccessToken(token);

    // Try to find existing member by Privy ID first
    const member = await storage.getMemberByPrivyId(verifiedClaims.user_id);

    req.privyUser = {
      id: verifiedClaims.user_id,
      // Get email/wallet from member if available (avoids extra API call)
      email: member?.email ?? undefined,
      wallet: member?.walletAddress ?? undefined,
    };
    if (member) {
      req.member = member;
    }

    next();
  } catch (error) {
    // Token invalid, but since this is optional, continue without auth
    console.warn('Optional Privy auth failed:', error);
    next();
  }
}
