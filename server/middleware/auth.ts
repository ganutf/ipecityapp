import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { MemberType } from '@shared/schema';

/**
 * Enhanced Request interface with user information
 */
interface AuthenticatedRequest extends Request {
  user?: {
    fid: number;
    memberType: MemberType;
    isAdmin: boolean;
    member: any; // Full member object
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
    
    if (!fid) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Farcaster FID must be provided in x-farcaster-fid header or request body'
      });
    }

    // Validate that the user exists in our system
    const member = await storage.getMember(fid);
    if (!member) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found in system'
      });
    }

    // Check if user is active or admin
    if (member.status !== 'active_member' && member.memberType !== 'admin') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User account is not active'
      });
    }

    // Add user info to request
    req.user = {
      fid,
      memberType: member.memberType as MemberType,
      isAdmin: member.memberType === 'admin',
      member
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
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
export const requireOwnership = (fidParamName: string = 'fid') => {
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
    const fid = req.user?.fid;
    const memberType = req.user?.memberType;
    const isAdmin = req.user?.isAdmin;
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress;
    
    console.log(`[AUDIT] ${timestamp} - ${action} - FID: ${fid} - Type: ${memberType} - Admin: ${isAdmin} - IP: ${ip} - Path: ${req.path}`);
    
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
 * Extract resource FID from URL parameters or request body
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