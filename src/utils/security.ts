/**
 * Security Utilities
 * 
 * This module provides security-related utilities including:
 * - Input sanitization
 * - XSS prevention
 * - SQL injection prevention (for Firestore queries)
 * - Rate limiting helpers
 */

/**
 * Allowed origins for CORS - Update this list with your production domains
 */
export const ALLOWED_ORIGINS = [
  'https://almalinks.com',
  'https://www.almalinks.com',
  'https://alma-links-test.web.app',
  'https://alma-links-test.firebaseapp.com',
  // Development origins (only in dev mode)
  ...(import.meta.env.DEV ? ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'] : [])
];

/**
 * Sanitize string input to prevent XSS attacks
 * Removes HTML tags and escapes special characters
 */
export function sanitizeString(input: string | null | undefined): string {
  if (!input) return '';
  
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Sanitize HTML content (allows safe HTML tags)
 * Use this for rich text content that needs formatting
 */
export function sanitizeHTML(input: string | null | undefined): string {
  if (!input) return '';
  
  // Remove script tags and event handlers
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  
  const sanitized = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    return null;
  }
  
  return sanitized;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeURL(url: string | null | undefined): string | null {
  if (!url) return null;
  
  const trimmed = url.trim();
  
  try {
    const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null;
    }
    
    return urlObj.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize Firebase document ID to prevent path traversal
 */
export function sanitizeDocumentId(id: string | null | undefined): string | null {
  if (!id) return null;
  
  // Remove any characters that could be used for path traversal
  const sanitized = id.replace(/[\/\\\.\.]/g, '').trim();
  
  // Firebase document IDs must be non-empty and less than 1500 bytes
  if (sanitized.length === 0 || sanitized.length > 1500) {
    return null;
  }
  
  return sanitized;
}

/**
 * Sanitize user input for Firestore queries
 * Prevents NoSQL injection attacks
 */
export function sanitizeFirestoreQuery(input: any): any {
  if (typeof input === 'string') {
    return sanitizeString(input);
  }
  
  if (typeof input === 'number') {
    // Validate number is finite and not NaN
    return isFinite(input) && !isNaN(input) ? input : null;
  }
  
  if (typeof input === 'boolean') {
    return input;
  }
  
  if (Array.isArray(input)) {
    return input.map(item => sanitizeFirestoreQuery(item)).filter(item => item !== null);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      const sanitizedKey = sanitizeString(key);
      if (sanitizedKey) {
        sanitized[sanitizedKey] = sanitizeFirestoreQuery(value);
      }
    }
    return sanitized;
  }
  
  return null;
}

/**
 * Validate CORS origin
 */
export function isValidOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Get CORS headers for API responses
 */
export function getCORSHeaders(origin: string | undefined): Record<string, string> {
  const isAllowed = isValidOrigin(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin! : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '3600'
  };
}

/**
 * Security headers for API responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebaseapp.com https://*.googleapis.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com;",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  };
}

/**
 * Rate limiting helper - Simple in-memory rate limiter
 * For production, use a proper rate limiting service (Redis, etc.)
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000 // 1 minute
  ) {}
  
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(timestamp => now - timestamp < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    
    return true;
  }
  
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }
}

// Export rate limiter instances for different use cases
export const apiRateLimiter = new RateLimiter(100, 60000); // 100 requests per minute
export const authRateLimiter = new RateLimiter(5, 60000); // 5 requests per minute (for login/register)
export const adminRateLimiter = new RateLimiter(200, 60000); // 200 requests per minute (for admin actions)

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize file name to prevent path traversal
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[\/\\\.\.]/g, '') // Remove path separators and parent directory references
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid characters with underscore
    .substring(0, 255); // Limit length
}

/**
 * Validate file type (MIME type check)
 */
export function isValidFileType(fileName: string, allowedTypes: string[]): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) return false;
  
  const mimeTypeMap: Record<string, string[]> = {
    'jpg': ['image/jpeg'],
    'jpeg': ['image/jpeg'],
    'png': ['image/png'],
    'gif': ['image/gif'],
    'pdf': ['application/pdf'],
    'doc': ['application/msword'],
    'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  };
  
  const fileMimeTypes = mimeTypeMap[extension] || [];
  return fileMimeTypes.some(type => allowedTypes.includes(type));
}

