/**
 * Input Sanitization Utilities
 * 
 * Comprehensive sanitization functions to prevent XSS, injection attacks,
 * and ensure data integrity across the application
 */

import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

/**
 * HTML Content Sanitization
 */
export class HtmlSanitizer {
  private static purifyConfig = {
    ALLOWED_TAGS: [], // No HTML tags allowed by default
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
  };
  
  /**
   * Sanitize HTML content - strips all tags by default
   */
  static sanitizeHtml(input: string, allowBasicTags = false): string {
    if (!input || typeof input !== 'string') return '';
    
    const config = allowBasicTags ? {
      ...this.purifyConfig,
      ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'p', 'br'],
      ALLOWED_ATTR: []
    } : this.purifyConfig;
    
    return DOMPurify.sanitize(input, config).trim();
  }
  
  /**
   * Sanitize text content for database storage
   */
  static sanitizeText(input: string, maxLength = 1000): string {
    if (!input || typeof input !== 'string') return '';
    
    return this.sanitizeHtml(input)
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, maxLength);
  }
  
  /**
   * Sanitize for SQL-safe content
   */
  static sanitizeForDatabase(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    // Remove SQL injection patterns while preserving legitimate content
    return input
      .replace(/['"\\]/g, '') // Remove quotes and backslashes
      .replace(/--.*$/gm, '') // Remove SQL comments
      .replace(/\/\*.*?\*\//g, '') // Remove block comments
      .replace(/;\s*$/g, '') // Remove trailing semicolons
      .trim();
  }
}

/**
 * URL and Link Sanitization
 */
export class UrlSanitizer {
  private static allowedProtocols = ['http:', 'https:'];
  private static allowedDomains = [
    'twitter.com', 'x.com',
    'linkedin.com',
    'instagram.com',
    'github.com',
    'medium.com',
    'youtube.com',
    'warpcast.com',
    'farcaster.xyz'
  ];
  
  /**
   * Sanitize and validate URL
   */
  static sanitizeUrl(input: string): string | null {
    if (!input || typeof input !== 'string') return null;
    
    try {
      // Remove potential XSS vectors
      const cleaned = input
        .replace(/javascript:/gi, '')
        .replace(/data:/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/file:/gi, '')
        .trim();
      
      const url = new URL(cleaned);
      
      // Validate protocol
      if (!this.allowedProtocols.includes(url.protocol)) {
        return null;
      }
      
      // Length check
      if (url.toString().length > 2048) {
        return null;
      }
      
      return url.toString();
    } catch {
      return null;
    }
  }
  
  /**
   * Sanitize social media handle
   */
  static sanitizeSocialHandle(input: string, platform: 'twitter' | 'linkedin' | 'instagram'): string {
    if (!input || typeof input !== 'string') return '';
    
    // Remove @ symbol and normalize
    const cleaned = input.replace(/^@/, '').toLowerCase();
    
    // Platform-specific validation
    switch (platform) {
      case 'twitter':
        return cleaned.match(/^[a-z0-9_]{1,15}$/)?.[0] || '';
      case 'linkedin':
        return cleaned.match(/^[a-z0-9-]{3,100}$/)?.[0] || '';
      case 'instagram':
        return cleaned.match(/^[a-z0-9_.]{1,30}$/)?.[0] || '';
      default:
        return '';
    }
  }
  
  /**
   * Create safe social media URL
   */
  static createSocialUrl(handle: string, platform: 'twitter' | 'linkedin' | 'instagram'): string | null {
    const sanitizedHandle = this.sanitizeSocialHandle(handle, platform);
    if (!sanitizedHandle) return null;
    
    const baseUrls = {
      twitter: 'https://twitter.com/',
      linkedin: 'https://linkedin.com/in/',
      instagram: 'https://instagram.com/'
    };
    
    return baseUrls[platform] + sanitizedHandle;
  }
}

/**
 * Username and Identifier Sanitization
 */
export class IdentifierSanitizer {
  /**
   * Sanitize username to alphanumeric only
   */
  static sanitizeUsername(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20)
      .trim();
  }
  
  /**
   * Validate and sanitize email address
   */
  static sanitizeEmail(input: string): string | null {
    if (!input || typeof input !== 'string') return null;
    
    // Basic email format validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const cleaned = input.toLowerCase().trim();
    
    if (!emailRegex.test(cleaned) || cleaned.length > 254) {
      return null;
    }
    
    // Check for dangerous patterns
    const dangerousPatterns = [
      /<script/i, /javascript:/i, /data:/i, /\+.*@/
    ];
    
    if (dangerousPatterns.some(pattern => pattern.test(cleaned))) {
      return null;
    }
    
    return cleaned;
  }
  
  /**
   * Sanitize Farcaster ID
   */
  static sanitizeFid(input: any): number | null {
    if (typeof input === 'number') {
      return input > 0 && input < 999999999 ? Math.floor(input) : null;
    }
    
    if (typeof input === 'string') {
      const parsed = parseInt(input, 10);
      return !isNaN(parsed) && parsed > 0 && parsed < 999999999 ? parsed : null;
    }
    
    return null;
  }
  
  /**
   * Sanitize wallet address
   */
  static sanitizeWalletAddress(input: string): string | null {
    if (!input || typeof input !== 'string') return null;
    
    const cleaned = input.trim();
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    
    return ethAddressRegex.test(cleaned) ? cleaned.toLowerCase() : null;
  }
}

/**
 * Array and Object Sanitization
 */
export class DataStructureSanitizer {
  /**
   * Sanitize array of strings
   */
  static sanitizeStringArray(input: any[], maxItems = 10, maxLength = 100): string[] {
    if (!Array.isArray(input)) return [];
    
    return input
      .filter(item => typeof item === 'string')
      .map(item => HtmlSanitizer.sanitizeText(item, maxLength))
      .filter(item => item.length > 0)
      .slice(0, maxItems);
  }
  
  /**
   * Sanitize profile tags
   */
  static sanitizeProfileTags(input: any[]): string[] {
    if (!Array.isArray(input)) return [];
    
    return input
      .filter(tag => typeof tag === 'string')
      .map(tag => tag.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim())
      .filter(tag => tag.length >= 2 && tag.length <= 30)
      .slice(0, 10);
  }
  
  /**
   * Deep sanitize object
   */
  static sanitizeObject(obj: any, allowedKeys: string[]): any {
    if (!obj || typeof obj !== 'object') return {};
    
    const sanitized: any = {};
    
    for (const key of allowedKeys) {
      if (key in obj) {
        const value = obj[key];
        
        if (typeof value === 'string') {
          sanitized[key] = HtmlSanitizer.sanitizeText(value);
        } else if (typeof value === 'number') {
          sanitized[key] = value;
        } else if (typeof value === 'boolean') {
          sanitized[key] = value;
        } else if (Array.isArray(value)) {
          sanitized[key] = this.sanitizeStringArray(value);
        }
      }
    }
    
    return sanitized;
  }
}

/**
 * Content Validation and Sanitization
 */
export class ContentSanitizer {
  /**
   * Sanitize bio/description content
   */
  static sanitizeBio(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    // Remove potential XSS vectors
    let sanitized = HtmlSanitizer.sanitizeText(input, 1000);
    
    // Remove multiple consecutive spaces/newlines
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Check for spam patterns
    const spamPatterns = [
      /(.)\1{10,}/, // Repeated characters
      /https?:\/\/[^\s]+/gi // URLs (remove for bio)
    ];
    
    spamPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    
    return sanitized.trim();
  }
  
  /**
   * Sanitize Farcaster URL
   */
  static sanitizeFarcasterUrl(input: string): string | null {
    if (!input || typeof input !== 'string') return null;
    
    const url = UrlSanitizer.sanitizeUrl(input);
    if (!url) return null;
    
    // Validate it's a Farcaster URL
    const farcasterDomains = ['warpcast.com', 'farcaster.xyz'];
    const urlObj = new URL(url);
    
    if (!farcasterDomains.includes(urlObj.hostname)) {
      return null;
    }
    
    return url;
  }
  
  /**
   * Sanitize date string
   */
  static sanitizeDate(input: string): string | null {
    if (!input || typeof input !== 'string') return null;
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const cleaned = input.trim();
    
    if (!dateRegex.test(cleaned)) return null;
    
    // Validate it's a real date
    const date = new Date(cleaned);
    if (isNaN(date.getTime())) return null;
    
    return cleaned;
  }
}

/**
 * Comprehensive sanitization function for member data
 */
export function sanitizeMemberData(data: any): any {
  return {
    farcasterFid: IdentifierSanitizer.sanitizeFid(data.farcasterFid),
    email: data.email ? IdentifierSanitizer.sanitizeEmail(data.email) : undefined,
    ipeUsername: data.ipeUsername ? IdentifierSanitizer.sanitizeUsername(data.ipeUsername) : undefined,
    bio: data.bio ? ContentSanitizer.sanitizeBio(data.bio) : undefined,
    twitter: data.twitter ? UrlSanitizer.sanitizeSocialHandle(data.twitter, 'twitter') : undefined,
    linkedin: data.linkedin ? UrlSanitizer.sanitizeSocialHandle(data.linkedin, 'linkedin') : undefined,
    instagram: data.instagram ? UrlSanitizer.sanitizeSocialHandle(data.instagram, 'instagram') : undefined,
    walletAddress: data.walletAddress ? IdentifierSanitizer.sanitizeWalletAddress(data.walletAddress) : undefined,
    profileTags: data.profileTags ? DataStructureSanitizer.sanitizeProfileTags(data.profileTags) : undefined
  };
}

/**
 * Sanitization for pulse data
 */
export function sanitizePulseData(data: any): any {
  return {
    farcasterUrl: ContentSanitizer.sanitizeFarcasterUrl(data.farcasterUrl),
    date: ContentSanitizer.sanitizeDate(data.date),
    description: data.description ? HtmlSanitizer.sanitizeText(data.description, 500) : undefined
  };
}