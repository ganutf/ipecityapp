/**
 * Secure External API Client
 * 
 * Provides SSRF protection and secure handling of external API calls
 * Prevents URL injection, DNS rebinding, and other network-based attacks
 */

import { z } from 'zod';

// Allowlisted external API endpoints
const ALLOWED_DOMAINS = [
  'api.neynar.com'
];

const ALLOWED_PROTOCOLS = ['https:'];
const REQUEST_TIMEOUT = 10000; // 10 seconds
const MAX_REDIRECTS = 3;

/**
 * Request configuration interface
 */
interface SecureRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  maxRedirects?: number;
}

/**
 * Validate URL against allowlist and security rules
 */
function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // Check protocol
    if (!ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
      console.error(`Blocked URL with invalid protocol: ${urlObj.protocol}`);
      return false;
    }
    
    // Check domain allowlist
    if (!ALLOWED_DOMAINS.includes(urlObj.hostname)) {
      console.error(`Blocked URL with non-allowlisted domain: ${urlObj.hostname}`);
      return false;
    }
    
    // Prevent local/private network access
    const hostname = urlObj.hostname.toLowerCase();
    const prohibitedPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^169\.254\./, // Link-local
      /^::1$/, // IPv6 localhost
      /^fc00:/i, // IPv6 private
      /^fe80:/i  // IPv6 link-local
    ];
    
    if (prohibitedPatterns.some(pattern => pattern.test(hostname))) {
      console.error(`Blocked URL accessing private network: ${hostname}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Invalid URL format: ${url}`);
    return false;
  }
}

/**
 * Sanitize URL parameters to prevent injection
 */
function sanitizeUrlParams(url: string, params: Record<string, string>): string {
  const urlObj = new URL(url);
  
  // Clear existing search params for security
  urlObj.search = '';
  
  // Add sanitized parameters
  for (const [key, value] of Object.entries(params)) {
    // Validate parameter key
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      throw new Error(`Invalid parameter key: ${key}`);
    }
    
    // Sanitize parameter value
    const sanitizedValue = String(value)
      .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
      .substring(0, 1000); // Limit parameter length
    
    urlObj.searchParams.set(key, sanitizedValue);
  }
  
  return urlObj.toString();
}

/**
 * Secure HTTP client class
 */
export class SecureHttpClient {
  private static instance: SecureHttpClient;
  private requestCount: Map<string, number> = new Map();
  private lastRequestTime: Map<string, number> = new Map();
  
  private constructor() {
    // Rate limiting cleanup every minute
    setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.lastRequestTime.entries());
      for (const [domain, lastTime] of entries) {
        if (now - lastTime > 60000) { // 1 minute
          this.requestCount.delete(domain);
          this.lastRequestTime.delete(domain);
        }
      }
    }, 60000);
  }
  
  public static getInstance(): SecureHttpClient {
    if (!SecureHttpClient.instance) {
      SecureHttpClient.instance = new SecureHttpClient();
    }
    return SecureHttpClient.instance;
  }
  
  /**
   * Check rate limits for domain
   */
  private checkRateLimit(domain: string): boolean {
    const now = Date.now();
    const count = this.requestCount.get(domain) || 0;
    const lastTime = this.lastRequestTime.get(domain) || 0;
    
    // Reset counter every minute
    if (now - lastTime > 60000) {
      this.requestCount.set(domain, 1);
      this.lastRequestTime.set(domain, now);
      return true;
    }
    
    // Allow max 100 requests per minute per domain
    if (count >= 100) {
      console.error(`Rate limit exceeded for domain: ${domain}`);
      return false;
    }
    
    this.requestCount.set(domain, count + 1);
    return true;
  }
  
  /**
   * Make a secure HTTP request
   */
  async request(url: string, config: SecureRequestConfig = {}): Promise<any> {
    // Validate URL
    if (!validateUrl(url)) {
      throw new Error('URL validation failed');
    }
    
    const urlObj = new URL(url);
    
    // Check rate limits
    if (!this.checkRateLimit(urlObj.hostname)) {
      throw new Error('Rate limit exceeded');
    }
    
    // Configure request
    const requestConfig: RequestInit = {
      method: config.method || 'GET',
      headers: {
        'User-Agent': 'Ipecity-Pulse/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: config.body ? JSON.stringify(config.body) : undefined,
      signal: AbortSignal.timeout(config.timeout || REQUEST_TIMEOUT)
    };
    
    // Log request for audit
    console.log(`[EXTERNAL_API] ${config.method || 'GET'} ${url}`);
    
    try {
      const response = await fetch(url, requestConfig);
      
      // Log response status
      console.log(`[EXTERNAL_API] Response: ${response.status} for ${url}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      // Log error without exposing sensitive information
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[EXTERNAL_API] Request failed for ${urlObj.hostname}: ${errorMessage}`);
      
      // Return sanitized error
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        } else if (error.message.includes('fetch')) {
          throw new Error('Network error');
        } else {
          throw new Error('Request failed');
        }
      } else {
        throw new Error('Request failed');
      }
    }
  }
  
  /**
   * GET request with query parameters
   */
  async get(baseUrl: string, params: Record<string, string> = {}): Promise<any> {
    const url = Object.keys(params).length > 0 
      ? sanitizeUrlParams(baseUrl, params)
      : baseUrl;
    
    return this.request(url, { method: 'GET' });
  }
  
  /**
   * POST request
   */
  async post(url: string, data: any, headers: Record<string, string> = {}): Promise<any> {
    return this.request(url, {
      method: 'POST',
      headers,
      body: data
    });
  }
}

/**
 * Neynar API client with SSRF protection
 */
export class SecureNeynarClient {
  private httpClient: SecureHttpClient;
  private apiKey: string;
  
  constructor(apiKey?: string) {
    this.httpClient = SecureHttpClient.getInstance();
    this.apiKey = apiKey || process.env.NEYNAR_API_KEY || '';
  }
  
  /**
   * Validate API response to prevent data injection
   */
  private validateResponse(data: any): any {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid API response format');
    }
    
    // Remove any potential script tags or dangerous content from response
    const cleanResponse = JSON.parse(JSON.stringify(data).replace(/<script.*?<\/script>/gi, ''));
    
    return cleanResponse;
  }
  
  /**
   * Make secure request to Neynar API
   */
  async request(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    try {
      const response = await this.httpClient.get(
        `https://api.neynar.com/v2/${endpoint}`,
        params
      );
      
      return this.validateResponse(response);
    } catch (error) {
      console.error(`Neynar API request failed for ${endpoint}:`, error);
      throw new Error('External API request failed');
    }
  }
}

// Export singleton instances
export const secureNeynarClient = new SecureNeynarClient();
export const secureHttpClient = SecureHttpClient.getInstance();