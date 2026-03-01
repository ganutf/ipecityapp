import { Request, Response, NextFunction } from 'express';
import { privy } from '../lib/privy';
import { storage } from '../storage';
import type { Member, MemberType } from '../../shared/schema';
import logger from '../logger';

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
    logger.warn('Privy middleware called but Privy not configured');
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
    logger.error('Privy auth error:', error);
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
    logger.warn('Optional Privy auth failed:', error);
    next();
  }
}

/**
 * Middleware to require admin privileges (V2 Privy auth)
 * Must be used after privyAuthMiddleware
 */
export function requireAdminV2(
  req: PrivyAuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.member) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'User must be authenticated',
    });
  }

  if (req.member.memberType !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin privileges required',
    });
  }

  next();
}

/**
 * Middleware to require resource ownership (V2 Privy auth)
 * Validates that the authenticated member owns the resource or is admin
 * Must be used after privyAuthMiddleware
 */
export function requireOwnershipV2(idParamName: string = 'memberId') {
  return (req: PrivyAuthRequest, res: Response, next: NextFunction) => {
    if (!req.member) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated',
      });
    }

    // Check URL params first, then request body
    const rawId = req.params[idParamName] ?? req.body?.[idParamName];
    const resourceId = rawId ? parseInt(String(rawId), 10) : NaN;

    if (isNaN(resourceId)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: `${idParamName} parameter is required`,
      });
    }

    if (req.member.id !== resourceId && req.member.memberType !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own resources',
      });
    }

    next();
  };
}

/**
 * Middleware to log auth events for audit purposes (V2 Privy auth)
 * Must be used after privyAuthMiddleware
 */
export function auditLoggerV2(action: string) {
  return (req: PrivyAuthRequest, res: Response, next: NextFunction) => {
    const memberId = req.member?.id;
    const memberType = req.member?.memberType;
    const isAdmin = memberType === 'admin';
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.socket.remoteAddress;

    logger.info(`[AUDIT] ${action}`, {
      memberId,
      memberType,
      isAdmin,
      ip,
      path: req.path,
      method: req.method,
    });

    if (req.body && Object.keys(req.body).length > 0) {
      const sanitizedBody = { ...req.body };
      delete sanitizedBody.password;
      delete sanitizedBody.secret;
      delete sanitizedBody.token;
      logger.info(`[AUDIT] ${action} - body`, sanitizedBody);
    }

    next();
  };
}
