import rateLimit from 'express-rate-limit';
import { getRateLimitKey, sanitizeEmail, validateEmail } from '../utils/security.js';

/**
 * Rate limiter configurations for authentication endpoints
 * 
 * Development: Uses IP+Email combined key (Option 1) - easier for testing
 * Production: Uses dual rate limiting (Option 3) - maximum security
 */

const isDevelopment = process.env.NODE_ENV === 'development';

// ============================================================================
// DEVELOPMENT: Option 1 - IP+Email Combined Key
// ============================================================================
const loginRateLimiterDev = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP+email combination to 5 login requests per windowMs
  message: {
    success: false,
    error: 'TOO_MANY_LOGIN_ATTEMPTS',
    message: 'Too many login attempts for this email. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Extract email from request body
    const email = req.body?.email;
    if (email && validateEmail(sanitizeEmail(email))) {
      return getRateLimitKey(req, sanitizeEmail(email));
    }
    // Fallback to IP-only if email is invalid/missing
    return getRateLimitKey(req);
  },
  skip: (req) => {
    // Skip rate limiting for localhost in development
    return isDevelopment && req.ip === '127.0.0.1';
  }
});

// ============================================================================
// PRODUCTION: Option 3 - Dual Rate Limiting (IP + Email)
// ============================================================================
// IP-based limiter (more lenient)
const loginRateLimiterIP = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Higher limit for IP
  keyGenerator: (req) => getRateLimitKey(req), // IP only
  message: {
    success: false,
    error: 'TOO_MANY_LOGIN_ATTEMPTS_IP',
    message: 'Too many login attempts from this network. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Email-based limiter (stricter)
const loginRateLimiterEmail = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Stricter limit per email
  keyGenerator: (req) => {
    const email = req.body?.email;
    if (email && validateEmail(sanitizeEmail(email))) {
      return `email:${sanitizeEmail(email)}`;
    }
    return `email:invalid`;
  },
  message: {
    success: false,
    error: 'TOO_MANY_LOGIN_ATTEMPTS_EMAIL',
    message: 'Too many login attempts for this email. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// EXPORT: Single rate limiter that works in both environments
// ============================================================================
/**
 * Login rate limiter - automatically uses appropriate strategy based on NODE_ENV
 * Development: IP+Email combined key (easier for testing)
 * Production: Dual limiting (IP + Email) - both must pass
 */
export const loginRateLimiter = isDevelopment 
  ? loginRateLimiterDev  // Development: single limiter
  : (req, res, next) => {  // Production: apply both limiters sequentially
      // Apply IP limiter first - it will call next() if it passes, or send response if rate-limited
      loginRateLimiterIP(req, res, () => {
        // If IP limiter passes (calls next), apply email limiter
        // Email limiter will call next() if it passes, or send response if rate-limited
        loginRateLimiterEmail(req, res, next);
      });
    };

/**
 * Registration rate limiter: 3 attempts per hour per IP
 */
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registration requests per hour
  message: {
    success: false,
    error: 'TOO_MANY_REGISTRATION_ATTEMPTS',
    message: 'Too many registration attempts. Please try again in 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Password recovery rate limiter: 3 attempts per hour per IP
 * This prevents abuse while still allowing legitimate users to recover
 */
export const recoverRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 recovery requests per hour
  message: {
    success: false,
    error: 'TOO_MANY_RECOVERY_ATTEMPTS',
    message: 'Too many password recovery attempts. Please try again in 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

