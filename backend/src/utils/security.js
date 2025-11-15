/**
 * Security utilities for authentication and input sanitization
 */
import { randomBytes } from 'crypto';

/**
 * Validate password complexity
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one safe symbol (!@#$%^&*()_+-=[]{}|;:,.<>?)
 * 
 * @param {string} password - Password to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validatePassword(password) {
  const errors = [];

  if (!password || password.length < 8) {
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

  // Safe symbols: !@#$%^&*()_+-=[]{}|;:,.<>?
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one safe symbol (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize input to prevent XSS attacks
 * Removes HTML tags and dangerous characters
 * 
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return String(input);
  }

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Escape special characters that could be used in XSS
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized.trim();
}

/**
 * Sanitize email input (less aggressive, just trim and lowercase)
 * 
 * @param {string} email - Email to sanitize
 * @returns {string} Sanitized email
 */
export function sanitizeEmail(email) {
  if (typeof email !== 'string') {
    return '';
  }
  return email.toLowerCase().trim();
}

/**
 * Validate email format
 * 
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
export function validateEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get client IP address from request
 * Handles proxies and load balancers
 * 
 * @param {Request} req - Express request object
 * @returns {string} IP address
 */
export function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}

/**
 * Rate limit key generator
 * Combines IP and optional email for rate limiting
 * 
 * @param {Request} req - Express request object
 * @param {string} email - Optional email address
 * @returns {string} Rate limit key
 */
export function getRateLimitKey(req, email = null) {
  const ip = getClientIp(req);
  return email ? `${ip}:${email.toLowerCase()}` : ip;
}

/**
 * Check if a timestamp is expired
 * 
 * @param {Date|string} expiresAt - Expiration timestamp
 * @returns {boolean} True if expired
 */
export function isExpired(expiresAt) {
  if (!expiresAt) return true;
  return new Date(expiresAt) < new Date();
}

/**
 * Generate a secure random token
 * 
 * @param {number} length - Token length in bytes (default 32)
 * @returns {string} Hex-encoded token
 */
export function generateSecureToken(length = 32) {
  return randomBytes(length).toString('hex');
}

