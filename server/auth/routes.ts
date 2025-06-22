import { Express, Request, Response } from 'express';
import { SessionManager } from './session-manager';
import { FarcasterAuthService } from './farcaster-auth';

export function registerAuthRoutes(app: Express): void {
  /**
   * GET /api/auth/session - Get current session
   */
  app.get('/api/auth/session', (req: Request, res: Response) => {
    const session = SessionManager.getSession(req);
    
    if (!session) {
      res.json({ user: null, isAuthenticated: false });
      return;
    }

    res.json({
      user: session.user,
      isAuthenticated: true,
      lastActivity: session.lastActivity,
    });
  });

  /**
   * POST /api/auth/login - Authenticate with Farcaster data
   */
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { fid, username, displayName, pfpUrl, custodyAddress } = req.body;

      if (!fid) {
        res.status(400).json({ 
          error: 'FID is required for authentication',
          code: 'INVALID_REQUEST'
        });
        return;
      }

      await FarcasterAuthService.authenticateUser(req, {
        fid: parseInt(fid),
        username,
        displayName,
        pfpUrl,
        custodyAddress,
      });

      const session = SessionManager.getSession(req);
      res.json({
        user: session?.user,
        isAuthenticated: true,
        message: 'Authentication successful',
      });
    } catch (error) {
      console.error('Login failed:', error);
      res.status(401).json({ 
        error: error instanceof Error ? error.message : 'Authentication failed',
        code: 'AUTH_FAILED'
      });
    }
  });

  /**
   * POST /api/auth/logout - Destroy current session
   */
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    FarcasterAuthService.logoutUser(req);
    res.json({ 
      message: 'Logout successful',
      isAuthenticated: false 
    });
  });

  /**
   * POST /api/auth/refresh - Refresh user data
   */
  app.post('/api/auth/refresh', async (req: Request, res: Response) => {
    const success = await FarcasterAuthService.refreshUserData(req);
    
    if (!success) {
      res.status(401).json({ 
        error: 'Session refresh failed',
        code: 'REFRESH_FAILED'
      });
      return;
    }

    const session = SessionManager.getSession(req);
    res.json({
      user: session?.user,
      isAuthenticated: true,
      message: 'Session refreshed successfully',
    });
  });

  /**
   * GET /api/auth/status - Simple auth status check
   */
  app.get('/api/auth/status', (req: Request, res: Response) => {
    const isAuthenticated = SessionManager.isAuthenticated(req);
    const user = SessionManager.getAuthenticatedUser(req);
    
    res.json({
      isAuthenticated,
      fid: user?.fid || null,
    });
  });
}