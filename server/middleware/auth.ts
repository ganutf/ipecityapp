import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { MemberType } from '@shared/schema';
import logger from '../logger';

/**
 * Enhanced Request interface with user information
 */
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;         // Internal member ID (primary)
    fid: number;        // Farcaster FID (for external APIs)
    memberType: MemberType;
    isAdmin: boolean;
    member: any;        // Full member object
  };
}

/**
 * Middleware to authenticate requests based on FID
 * Validates that the user exists in the system and attaches user info to request
 */
export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract FID from various sources
    const fid = extractFidFromRequest(req);
    
    logger.debug('Auth middleware processing request', { 
      method: req.method, 
      path: req.path, 
      fid,
      hasHeader: !!req.headers['x-farcaster-fid']
    });
    
    if (!fid) {
      logger.debug('Authentication failed: No FID found in request');
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Farcaster FID must be provided in x-farcaster-fid header or request body'
      });
    }

    // Validate that the user exists in our system
    const member = await storage.getMemberByFarcasterFid(fid);
    logger.debug('Member lookup completed', member ? {
      memberId: member.id,
      farcasterFid: member.farcasterFid,
      status: member.status,
      memberType: member.memberType
    } : { fid, found: false });
    
    if (!member) {
      logger.debug('Authentication failed: Member not found', { fid });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found in system'
      });
    }

    // Check if user is active or admin - be more permissive during development
    const allowedStatuses = ['active_member', 'approved_application', 'email_verified'];
    const isAdmin = member.memberType === 'admin';
    
    if (!allowedStatuses.includes(member.status) && !isAdmin) {
      logger.debug('Authentication failed: User account not active', { 
        fid, 
        status: member.status, 
        memberType: member.memberType,
        allowedStatuses 
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: `User account is not active. Status: ${member.status}`
      });
    }

    // Add user info to request (both internal and external IDs)
    req.user = {
      id: member.id,                                    // Internal member ID
      fid,                                              // External farcaster FID
      memberType: member.memberType as MemberType,
      isAdmin: member.memberType === 'admin',
      member
    };

    logger.debug('Authentication successful', { 
      fid, 
      memberId: member.id, 
      memberType: member.memberType,
      status: member.status 
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', { 
      error: (error as Error)?.message || 'Unknown error', 
      stack: (error as Error)?.stack 
    });
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
};

/**
 * Middleware to require admin privileges
 * Must be used after authenticateUser middleware
 */
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'User must be authenticated'
    });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin privileges required'
    });
  }

  next();
};

/**
 * Middleware to require user ownership of resource
 * Validates that the authenticated user owns the resource they're trying to access
 */
export const requireOwnership = (idParamName: string = 'memberId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated'
      });
    }

    const resourceId = extractResourceId(req, idParamName);

    if (!resourceId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: `${idParamName} parameter is required`
      });
    }

    // Allow if user owns the resource or is admin
    if (req.user.id !== resourceId && !req.user.isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own resources'
      });
    }

    next();
  };
};

// Legacy ownership validation for farcasterFid-based endpoints
export const requireOwnershipByFid = (fidParamName: string = 'fid') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated'
      });
    }

    const resourceFid = extractResourceFid(req, fidParamName);

    if (!resourceFid) {
      return res.status(400).json({
        error: 'Invalid request',
        message: `${fidParamName} parameter is required`
      });
    }

    // Allow if user owns the resource or is admin
    if (req.user.fid !== resourceFid && !req.user.isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own resources'
      });
    }

    next();
  };
};

/**
 * Middleware to log authentication events for audit purposes
 */
export const auditLogger = (action: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const memberId = req.user?.id;
    const fid = req.user?.fid;
    const memberType = req.user?.memberType;
    const isAdmin = req.user?.isAdmin;
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress;
    
    console.log(`[AUDIT] ${timestamp} - ${action} - ID: ${memberId} - FID: ${fid} - Type: ${memberType} - Admin: ${isAdmin} - IP: ${ip} - Path: ${req.path}`);
    
    // Also log request body for sensitive operations (excluding passwords/secrets)
    if (req.body && Object.keys(req.body).length > 0) {
      const sanitizedBody = { ...req.body };
      // Remove sensitive fields
      delete sanitizedBody.password;
      delete sanitizedBody.secret;
      delete sanitizedBody.token;
      console.log(`[AUDIT] ${timestamp} - ${action} - Request Body:`, JSON.stringify(sanitizedBody));
    }
    
    next();
  };
};

/**
 * Extract FID from request headers, body, or query parameters
 */
function extractFidFromRequest(req: Request): number | null {
  // Check custom header first (preferred method)
  const headerFid = req.headers['x-farcaster-fid'];
  if (headerFid) {
    const parsed = parseInt(headerFid as string);
    if (!isNaN(parsed)) return parsed;
  }

  // Check body
  if (req.body.farcasterFid) {
    const parsed = parseInt(req.body.farcasterFid);
    if (!isNaN(parsed)) return parsed;
  }

  if (req.body.fid) {
    const parsed = parseInt(req.body.fid);
    if (!isNaN(parsed)) return parsed;
  }

  // Check query parameters
  if (req.query.fid) {
    const parsed = parseInt(req.query.fid as string);
    if (!isNaN(parsed)) return parsed;
  }

  return null;
}

/**
 * Extract resource ID (memberId) from URL parameters or request body
 */
function extractResourceId(req: Request, paramName: string): number | null {
  // Check URL parameters first
  if (req.params[paramName]) {
    const parsed = parseInt(req.params[paramName]);
    if (!isNaN(parsed)) return parsed;
  }

  // Check common parameter names
  if (req.params.memberId) {
    const parsed = parseInt(req.params.memberId);
    if (!isNaN(parsed)) return parsed;
  }

  if (req.params.id) {
    const parsed = parseInt(req.params.id);
    if (!isNaN(parsed)) return parsed;
  }

  // Check request body
  if (req.body.memberId) {
    const parsed = parseInt(req.body.memberId);
    if (!isNaN(parsed)) return parsed;
  }

  if (req.body.id) {
    const parsed = parseInt(req.body.id);
    if (!isNaN(parsed)) return parsed;
  }

  return null;
}

/**
 * Extract resource FID from URL parameters or request body (legacy)
 */
function extractResourceFid(req: Request, paramName: string): number | null {
  // Check URL parameters first
  if (req.params[paramName]) {
    const parsed = parseInt(req.params[paramName]);
    if (!isNaN(parsed)) return parsed;
  }

  // Check common parameter names
  if (req.params.farcasterFid) {
    const parsed = parseInt(req.params.farcasterFid);
    if (!isNaN(parsed)) return parsed;
  }

  if (req.params.fid) {
    const parsed = parseInt(req.params.fid);
    if (!isNaN(parsed)) return parsed;
  }

  // Check request body
  if (req.body.farcasterFid) {
    const parsed = parseInt(req.body.farcasterFid);
    if (!isNaN(parsed)) return parsed;
  }

  if (req.body.fid) {
    const parsed = parseInt(req.body.fid);
    if (!isNaN(parsed)) return parsed;
  }

  return null;
}

/**
 * Type guard to check if request is authenticated
 */
export function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return 'user' in req && req.user !== undefined;
}

/**
 * Helper function to get current user from request
 */
export function getCurrentUser(req: Request) {
  if (isAuthenticated(req)) {
    return req.user;
  }
  return null;
}

// Export the enhanced request type for use in route handlers
export type { AuthenticatedRequest };