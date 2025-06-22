import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

export interface AuthSession {
  user: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
    custodyAddress?: string;
  };
  isAuthenticated: boolean;
  createdAt: number;
  lastActivity: number;
}

export interface AuthenticatedRequest extends Request {
  session: AuthSession & { user: NonNullable<AuthSession['user']> };
}

export class SessionManager {
  private static readonly SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly ACTIVITY_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Create a new authenticated session
   */
  static createSession(req: Request, userData: AuthSession['user']): void {
    const session: AuthSession = {
      user: userData,
      isAuthenticated: true,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    (req.session as any).auth = session;
  }

  /**
   * Get current session if valid
   */
  static getSession(req: Request): AuthSession | null {
    const session = (req.session as any)?.auth as AuthSession;
    
    if (!session || !session.isAuthenticated) {
      return null;
    }

    // Check if session has expired
    const now = Date.now();
    const sessionAge = now - session.createdAt;
    const lastActivityAge = now - session.lastActivity;

    if (sessionAge > this.SESSION_DURATION || lastActivityAge > this.ACTIVITY_TIMEOUT) {
      this.destroySession(req);
      return null;
    }

    // Update last activity
    session.lastActivity = now;
    (req.session as any).auth = session;

    return session;
  }

  /**
   * Update session user data
   */
  static updateSession(req: Request, userData: Partial<AuthSession['user']>): void {
    const session = this.getSession(req);
    if (session) {
      session.user = { ...session.user, ...userData };
      session.lastActivity = Date.now();
      (req.session as any).auth = session;
    }
  }

  /**
   * Destroy the current session
   */
  static destroySession(req: Request): void {
    delete (req.session as any).auth;
  }

  /**
   * Middleware to require authentication
   */
  static requireAuth(req: Request, res: Response, next: NextFunction): void {
    const session = SessionManager.getSession(req);
    
    if (!session) {
      res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // Attach session to request for type safety
    (req as AuthenticatedRequest).session = session;
    next();
  }

  /**
   * Middleware to optionally attach session
   */
  static optionalAuth(req: Request, res: Response, next: NextFunction): void {
    const session = SessionManager.getSession(req);
    if (session) {
      (req as AuthenticatedRequest).session = session;
    }
    next();
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(req: Request): boolean {
    return !!SessionManager.getSession(req);
  }

  /**
   * Get authenticated user or null
   */
  static getAuthenticatedUser(req: Request): AuthSession['user'] | null {
    const session = SessionManager.getSession(req);
    return session?.user || null;
  }
}

/**
 * Type guard for authenticated requests
 */
export function isAuthenticatedRequest(req: Request): req is AuthenticatedRequest {
  return SessionManager.isAuthenticated(req);
}