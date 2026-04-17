import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import { VALIDATION_LIMITS, VALIDATION_PATTERNS, RATE_LIMITS, TIMING } from '@shared/constants';

// Re-export validation schemas from shared for backward compatibility
export {
  secureUsernameSchema as usernameSchema,
  secureEmailSchema as emailSchema,
  secureBioSchema as bioSchema,
  secureFidSchema as fidSchema,
  secureWalletAddressSchema as walletAddressSchema,
  secureSocialHandleSchema as socialMediaSchema,
} from '@shared/schema';

/**
 * Comprehensive Input Validation Middleware
 *
 * Provides secure validation and sanitization for all user inputs
 * to prevent SQL injection, XSS, and other injection attacks
 *
 * NOTE: Validation schemas have been consolidated in @shared/schema.ts
 * This file now re-exports them for backward compatibility and provides
 * middleware functions for request validation.
 */

// Security validation schema for generic strings
export const secureStringSchema = z.string()
  .min(1, "Field cannot be empty")
  .max(VALIDATION_LIMITS.BIO_MAX_LENGTH, "Field too long")
  .refine(val => !VALIDATION_PATTERNS.DANGEROUS_PATTERNS.some(p => p.test(val)), "Invalid content detected");

// URL validation schema
export const urlSchema = z.string()
  .url("Invalid URL format")
  .max(2048, "URL too long")
  .refine(val => {
    try {
      const url = new URL(val);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  }, "Only HTTP/HTTPS URLs allowed")
  .refine(val => !val.includes('<script'), "Invalid URL content");

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';
  
  // Use DOMPurify to clean HTML
  const cleaned = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
  
  return cleaned.trim();
}

/**
 * Sanitize and validate username input
 */
export function sanitizeUsername(input: string): string {
  if (!input) return '';
  
  // Remove all non-alphanumeric characters and convert to lowercase
  const sanitized = input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20); // Limit length
  
  return sanitized;
}

/**
 * Sanitize URL input
 */
export function sanitizeUrl(input: string): string | null {
  if (!input) return null;
  
  try {
    const url = new URL(input);
    
    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    
    // Return the sanitized URL
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Validate and sanitize array input
 */
export function sanitizeArray(input: any[]): string[] {
  if (!Array.isArray(input)) return [];
  
  return input
    .filter(item => typeof item === 'string')
    .map(item => sanitizeHtml(item))
    .filter(item => item.length > 0)
    .slice(0, 10); // Limit array size
}

/**
 * Request validation middleware factory
 */
export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (req.body && Object.keys(req.body).length > 0) {
        const result = schema.safeParse(req.body);
        
        if (!result.success) {
          return res.status(400).json({
            error: 'Validation failed',
            details: result.error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message
            }))
          });
        }
        
        // Replace request body with validated data
        req.body = result.data;
      }
      
      // Validate URL parameters
      if (req.params) {
        for (const [key, value] of Object.entries(req.params)) {
          if (typeof value === 'string') {
            // Check for SQL injection patterns
            const sqlPatterns = [
              /union\s+select/i, /drop\s+table/i, /delete\s+from/i,
              /insert\s+into/i, /update\s+set/i, /;\s*--/,
              /'\s*or\s*'1'\s*=\s*'1/i, /'\s*or\s*1\s*=\s*1/i
            ];
            
            if (sqlPatterns.some(pattern => pattern.test(value))) {
              return res.status(400).json({
                error: 'Invalid parameter',
                message: 'Parameter contains potentially dangerous content'
              });
            }
            
            // Validate FID parameters
            if (key.toLowerCase().includes('fid') && !/^\d+$/.test(value)) {
              return res.status(400).json({
                error: 'Invalid FID',
                message: 'FID must be a positive integer'
              });
            }
          }
        }
      }
      
      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      return res.status(500).json({
        error: 'Internal validation error'
      });
    }
  };
}

/**
 * Sanitize request body middleware
 */
export function sanitizeRequestBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    // Recursively sanitize all string values in the request body
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return sanitizeHtml(obj);
      } else if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      } else if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      return obj;
    };
    
    req.body = sanitizeObject(req.body);
  }
  
  next();
}

/**
 * Endpoint-specific validation schemas
 * NOTE: Most schemas are now in @shared/schema.ts - re-exported here for backward compatibility
 */

// Re-export endpoint schemas from shared
export {
  emailVerificationRequestSchema as emailVerificationSchema,
  usernameClaimSchema,
  applicationSchema as memberRegistrationSchema,
} from '@shared/schema';

// Verification code schema (not in shared, keeping local)
import { secureFidSchema } from '@shared/schema';
export const verificationCodeSchema = z.object({
  farcasterFid: secureFidSchema,
  code: z.string().length(TIMING.EMAIL_CODE_LENGTH, `Verification code must be ${TIMING.EMAIL_CODE_LENGTH} characters`).regex(/^\d+$/, "Code must be numeric")
});

// Re-export constants from shared for backward compatibility
export { VALIDATION_LIMITS as maxLengths, RATE_LIMITS as requestLimits } from '@shared/constants';

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent XSS attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy — only in production
  // In development, Vite manages its own CSP and needs ws:// for HMR
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://replit.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https://api.neynar.com https://api.justaname.id https://cdn.justaname.id https://relay.farcaster.xyz https://pulse.walletconnect.org https://api.web3modal.org https://mainnet.infura.io https://rpc.ankr.com https://mainnet.optimism.io https://optimism-mainnet.infura.io https://opt-mainnet.g.alchemy.com https://ethereum.publicnode.com https://optimism.publicnode.com https://rpc.payload.de https://eth.blockrazor.xyz https://eth.merkle.io https://*.wallet.coinbase.com https://walletconnect.com https://ethereum-api.xyz https://ccip-v2.ens.xyz https://mainnet.base.org https://cca-lite.coinbase.com https://auth.privy.io https://*.rpc.privy.systems https://explorer-api.walletconnect.com wss://www.walletlink.org wss://relay.walletconnect.org wss://relay.walletconnect.com wss://bridge.walletconnect.org;" +
      "frame-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org; " +
      "frame-ancestors 'none'"
    );
  }

  next();
}