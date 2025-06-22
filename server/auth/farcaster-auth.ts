import { Request, Response } from 'express';
import { SessionManager } from './session-manager';
import { storage } from '../storage';

export interface FarcasterAuthData {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  custodyAddress?: string;
  verifications?: string[];
}

export class FarcasterAuthService {
  /**
   * Process Farcaster authentication data and create session
   */
  static async authenticateUser(req: Request, authData: FarcasterAuthData): Promise<void> {
    try {
      // Validate required fields
      if (!authData.fid || typeof authData.fid !== 'number') {
        throw new Error('Valid FID is required for authentication');
      }

      // Check if user is an approved member
      const member = await storage.getMember(authData.fid);
      
      if (!member || !member.approved) {
        throw new Error('User is not an approved community member');
      }

      // Create user session with validated data
      const sessionUser = {
        fid: authData.fid,
        username: authData.username || member.farcasterUsername,
        displayName: authData.displayName || member.displayName,
        pfpUrl: authData.pfpUrl,
        custodyAddress: authData.custodyAddress,
      };

      SessionManager.createSession(req, sessionUser);

      console.log(`User authenticated: FID ${authData.fid} (${sessionUser.username})`);
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Handle user logout
   */
  static logoutUser(req: Request): void {
    const user = SessionManager.getAuthenticatedUser(req);
    if (user) {
      console.log(`User logged out: FID ${user.fid} (${user.username})`);
    }
    SessionManager.destroySession(req);
  }

  /**
   * Refresh user data from storage
   */
  static async refreshUserData(req: Request): Promise<boolean> {
    const session = SessionManager.getSession(req);
    if (!session) {
      return false;
    }

    try {
      const member = await storage.getMember(session.user.fid);
      
      if (!member || !member.approved) {
        // User is no longer approved, destroy session
        SessionManager.destroySession(req);
        return false;
      }

      // Update session with latest member data
      SessionManager.updateSession(req, {
        username: member.farcasterUsername,
        displayName: member.displayName,
      });

      return true;
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      return false;
    }
  }

  /**
   * Check if user has admin privileges
   */
  static isAdmin(req: Request): boolean {
    const user = SessionManager.getAuthenticatedUser(req);
    return user?.fid === 2790; // Jean Hansen's FID
  }

  /**
   * Middleware to require admin access
   */
  static requireAdmin(req: Request, res: Response, next: Function): void {
    if (!FarcasterAuthService.isAdmin(req)) {
      res.status(403).json({ 
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
      return;
    }
    next();
  }
}