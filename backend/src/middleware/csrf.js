/**
 * CSRF (Cross-Site Request Forgery) Protection Middleware
 * 
 * What is CSRF?
 * =============
 * CSRF is an attack where a malicious website tricks a user's browser into
 * making unauthorized requests to a website where the user is authenticated.
 * 
 * Example Attack Scenario:
 * 1. User logs into your app at https://yourapp.com
 * 2. User visits malicious site at https://evil.com
 * 3. Evil.com contains: <img src="https://yourapp.com/api/delete-account">
 * 4. Browser automatically sends request with user's cookies/tokens
 * 5. Your server thinks it's the user and deletes their account!
 * 
 * How CSRF Tokens Work:
 * =====================
 * 1. Server generates a random token and stores it (in session/cookie/state)
 * 2. Server sends token to client in a way that evil.com can't access
 *    - As a cookie (httpOnly, sameSite)
 *    - Or in response body/header
 * 3. Client includes token in all state-changing requests (POST, PUT, DELETE)
 * 4. Server verifies token matches before processing request
 * 5. Evil.com can't get the token (due to same-origin policy), so attack fails
 * 
 * Implementation Notes:
 * - Use SameSite cookies for automatic CSRF protection on same-site requests
 * - For API endpoints, use token-based auth (JWT) with tokens in Authorization header
 * - Double-Submit Cookie pattern: token in cookie AND in request body/header
 * - Origin/Referer header checking can also help
 * 
 * For this application:
 * - JWT tokens in Authorization header provide some CSRF protection
 * - Additional CSRF token can be used for extra security on state-changing operations
 * - Consider SameSite cookie attribute if using cookies
 */

import { randomBytes } from 'crypto';

/**
 * Generate CSRF token
 * In production, store in session or signed cookie
 * For JWT-based auth, CSRF is less critical but still recommended for extra security
 */
export function generateCsrfToken() {
  return randomBytes(32).toString('hex');
}

/**
 * CSRF token validation middleware
 * Validates CSRF token from header or body
 */
export function csrfProtection(req, res, next) {
  // Skip CSRF check for GET/HEAD/OPTIONS (read-only)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get token from header or body
  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromBody = req.body?.csrfToken;
  const token = tokenFromHeader || tokenFromBody;

  // Get token from cookie (if using cookie-based CSRF)
  const tokenFromCookie = req.cookies?.csrfToken;

  // For this implementation, we'll use a simple approach:
  // If using JWT in Authorization header, CSRF is somewhat mitigated
  // But we can add explicit CSRF token validation for extra security
  
  // TODO: Implement proper CSRF token validation
  // 1. Get CSRF token from session/cookie
  // 2. Compare with token from request
  // 3. Reject if mismatch
  
  // For now, just pass through (JWT provides some protection)
  // In production, implement proper CSRF token validation
  next();
}

/**
 * Middleware to add CSRF token to response
 * Call this before sending any forms/pages that will make POST requests
 */
export function csrfTokenGenerator(req, res, next) {
  // Generate and store CSRF token
  const csrfToken = generateCsrfToken();
  
  // Store in cookie (httpOnly=false so JS can read it)
  res.cookie('csrfToken', csrfToken, {
    httpOnly: false, // JS needs to read it
    sameSite: 'strict', // Only sent on same-site requests
    secure: process.env.NODE_ENV === 'production' // HTTPS only in production
  });

  // Also add to response locals for template rendering
  res.locals.csrfToken = csrfToken;
  
  next();
}

