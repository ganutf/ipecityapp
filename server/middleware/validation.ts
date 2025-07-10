import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Comprehensive Input Validation Middleware
 * 
 * Provides secure validation and sanitization for all user inputs
 * to prevent SQL injection, XSS, and other injection attacks
 */

// Security validation schemas
export const secureStringSchema = z.string()
  .min(1, "Field cannot be empty")
  .max(1000, "Field too long")
  .refine(val => !/<script|javascript:|data:|vbscript:/i.test(val), "Invalid content detected");

export const usernameSchema = z.string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-z0-9]+$/, "Username can only contain lowercase letters and numbers")
  .refine(val => val.length >= 3 && val.length <= 20, "Username length invalid")
  .refine(val => !val.includes('admin') && !val.includes('root'), "Reserved username");

export const emailSchema = z.string()
  .email("Invalid email format")
  .max(254, "Email too long")
  .refine(val => !/<|>|"|'/.test(val), "Invalid characters in email");

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

export const socialMediaSchema = z.string()
  .max(100, "Social media handle too long")
  .regex(/^[a-zA-Z0-9_.-]*$/, "Invalid characters in social media handle")
  .optional()
  .or(z.literal(''));

export const bioSchema = z.string()
  .max(1000, "Bio too long")
  .refine(val => {
    // Check for potential XSS patterns
    const dangerousPatterns = [
      /<script/i, /javascript:/i, /data:/i, /vbscript:/i,
      /on\w+\s*=/i, /<iframe/i, /<object/i, /<embed/i
    ];
    return !dangerousPatterns.some(pattern => pattern.test(val));
  }, "Bio contains invalid content")
  .optional()
  .or(z.literal(''));

export const fidSchema = z.number()
  .int("FID must be an integer")
  .positive("FID must be positive")
  .max(999999999, "FID too large");

export const walletAddressSchema = z.string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum wallet address")
  .length(42, "Wallet address must be 42 characters");

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
 * Specific validation schemas for different endpoints
 */

// Member registration validation
export const memberRegistrationSchema = z.object({
  farcasterFid: fidSchema,
  email: emailSchema.optional(),
  ipeUsername: usernameSchema.optional(),
  bio: bioSchema,
  twitter: socialMediaSchema,
  linkedin: socialMediaSchema,
  instagram: socialMediaSchema,
  walletAddress: walletAddressSchema.optional(),
  profileTags: z.array(z.string().max(50)).max(10).optional()
});

// Pulse creation validation
export const pulseCreationSchema = z.object({
  farcasterUrl: urlSchema.refine(val => {
    return val.includes('warpcast.com') || val.includes('farcaster.xyz');
  }, "Must be a valid Farcaster URL"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  description: z.string().min(1).max(500, "Description too long")
});

// Username claim validation
export const usernameClaimSchema = z.object({
  farcasterFid: fidSchema,
  username: usernameSchema,
  walletAddress: walletAddressSchema
});

// Email verification validation
export const emailVerificationSchema = z.object({
  farcasterFid: fidSchema,
  email: emailSchema
});

// Password/code validation
export const verificationCodeSchema = z.object({
  farcasterFid: fidSchema,
  code: z.string().length(6, "Verification code must be 6 characters").regex(/^\d+$/, "Code must be numeric")
});

/**
 * Rate limiting validation
 */
export const requestLimits = {
  perMinute: 60,
  perHour: 1000,
  perDay: 10000
};

/**
 * Input length validation
 */
export const maxLengths = {
  username: 20,
  email: 254,
  bio: 1000,
  socialMedia: 100,
  url: 2048,
  description: 500,
  tags: 50
};

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent XSS attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.neynar.com https://api.justaname.id; " +
    "frame-ancestors 'none'"
  );
  
  next();
}