import rateLimit from 'express-rate-limit';

/**
 * Rate limiter configurations for authentication endpoints
 * 
 * Note: Multiple users can share the same IP (corporate networks, VPNs, etc.),
 * so rate limits are per-IP. For stricter control, consider per-email limits
 * combined with IP limits, but be aware this might affect legitimate users
 * behind the same NAT/proxy.
 */

/**
 * Login rate limiter: 5 attempts per 15 minutes per IP
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: {
    success: false,
    error: 'TOO_MANY_LOGIN_ATTEMPTS',
    message: 'Too many login attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use IP from headers if behind a proxy
  skip: (req) => {
    // Skip rate limiting for localhost in development
    return process.env.NODE_ENV === 'development' && req.ip === '127.0.0.1';
  }
});

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

