/**
 * Authentication Middleware
 * Extracts and verifies JWT tokens from Authorization header
 * Attaches user info to req.user on success
 */

import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Authenticate user via JWT token
 * Expects: Authorization: Bearer <token>
 * On success: Sets req.user = { id, email, role }
 * On failure: Returns 401 Unauthorized
 */
export function authenticate(req, res, next)
{
   try
   {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer '))
      {
         return res.status(401).json(
         {
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Missing or invalid Authorization header. Expected: Bearer <token>'
         });
      }

      // Extract token (remove 'Bearer ' prefix)
      const token = authHeader.substring(7);

      // Verify token
      const decoded = verifyAccessToken(token);

      if (!decoded)
      {
         return res.status(401).json(
         {
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Invalid or expired token'
         });
      }

      // Attach user info to request
      req.user = 
      {
         id: decoded.id,
         email: decoded.email,
         role: decoded.role
      };

      // Continue to next middleware/route handler
      next();
   }
   catch (error)
   {
      console.error('Authentication error:', error);
      return res.status(401).json(
      {
         success: false,
         error: 'UNAUTHORIZED',
         message: 'Authentication failed'
      });
   }
}

/**
 * Optional authentication - doesn't fail if token is missing/invalid
 * Useful for routes that work for both authenticated and anonymous users
 * Sets req.user only if valid token is provided
 */
export function optionalAuthenticate(req, res, next)
{
   try
   {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer '))
      {
         const token = authHeader.substring(7);
         const decoded = verifyAccessToken(token);

         if (decoded)
         {
            req.user = {
               id: decoded.id,
               email: decoded.email,
               role: decoded.role
            };
         }
      }

      next();
   }
   catch (error)
   {
      // Continue even on error for optional auth
      next();
   }
}
