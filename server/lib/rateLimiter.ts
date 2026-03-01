import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  private getKey(req: Request): string {
    // Use user ID if authenticated, otherwise fall back to IP
    const user = (req as Request & { user?: { fid?: number; id?: number } }).user;
    const userId = user?.fid || user?.id;
    return userId ? `user:${userId}` : `ip:${req.ip}`;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.getKey(req);
      const now = Date.now();
      
      if (!this.store[key] || this.store[key].resetTime < now) {
        this.store[key] = {
          count: 1,
          resetTime: now + this.windowMs
        };
        return next();
      }

      if (this.store[key].count >= this.maxRequests) {
        const resetTime = Math.ceil((this.store[key].resetTime - now) / 1000);
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: resetTime,
          limit: this.maxRequests,
          windowMs: this.windowMs
        });
      }

      this.store[key].count++;
      next();
    };
  }
}

// Rate limiters for different operations
export const attestationRateLimit = new RateLimiter(60000, 5); // 5 requests per minute for attestations
export const bulkAttestationRateLimit = new RateLimiter(300000, 2); // 2 requests per 5 minutes for bulk operations

// Timeout wrapper for async operations
export function withTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number = 30000,
  operation: string = 'Operation'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}