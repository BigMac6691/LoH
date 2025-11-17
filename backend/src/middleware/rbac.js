/**
 * Role-Based Access Control (RBAC) Middleware
 * Provides authorization checks based on user roles
 * Must be used after authenticate middleware (requires req.user)
 */

import { pool } from '../db/pool.js';

/**
 * Require user to have one of the specified roles
 * @param {string|string[]} requiredRoles - Single role or array of roles
 * @returns {Function} Express middleware function
 */
export function requireRole(requiredRoles) {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    // Check if user has required role
    if (!roles.includes(req.user.role)) {
      console.warn(`Authorization failed: User ${req.user.id} (${req.user.role}) attempted to access ${req.method} ${req.path} requiring roles: ${roles.join(', ')}`);
      
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: `Insufficient permissions. Required role: ${roles.join(' or ')}`
      });
    }

    next();
  };
}

/**
 * Require user to have any of the specified roles (alias for requireRole)
 * @param {string|string[]} roles - Single role or array of roles
 * @returns {Function} Express middleware function
 */
export function requireAnyRole(roles) {
  return requireRole(roles);
}

/**
 * Require user to be the owner of a game
 * Expects gameId in req.params.gameId
 * @returns {Function} Express middleware function
 */
export function requireGameOwner() {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const { gameId } = req.params;

    if (!gameId) {
      return res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Game ID is required'
      });
    }

    try {
      // Check if user owns the game
      const { rows } = await pool.query(
        'SELECT owner_id FROM game WHERE id = $1',
        [gameId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Game not found'
        });
      }

      const gameOwnerId = rows[0].owner_id;

      // Owner role can access any game
      if (req.user.role === 'owner') {
        return next();
      }

      // Check if user is the game owner
      if (gameOwnerId !== req.user.id) {
        console.warn(`Authorization failed: User ${req.user.id} attempted to access game ${gameId} owned by ${gameOwnerId}`);
        
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'You do not own this game'
        });
      }

      next();
    } catch (error) {
      console.error('Error checking game ownership:', error);
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to verify game ownership'
      });
    }
  };
}

/**
 * Require user to be the game owner OR have admin/owner role
 * Expects gameId in req.params.gameId
 * @returns {Function} Express middleware function
 */
export function requireGameOwnerOrAdmin() {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    // Admin and owner can access any game
    if (req.user.role === 'admin' || req.user.role === 'owner') {
      return next();
    }

    // For other roles, check ownership
    const { gameId } = req.params;

    if (!gameId) {
      return res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Game ID is required'
      });
    }

    try {
      const { rows } = await pool.query(
        'SELECT owner_id FROM game WHERE id = $1',
        [gameId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Game not found'
        });
      }

      const gameOwnerId = rows[0].owner_id;

      if (gameOwnerId !== req.user.id) {
        console.warn(`Authorization failed: User ${req.user.id} attempted to access game ${gameId} owned by ${gameOwnerId}`);
        
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'You must be the game owner or an admin to perform this action'
        });
      }

      next();
    } catch (error) {
      console.error('Error checking game ownership:', error);
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to verify game ownership'
      });
    }
  };
}

/**
 * Require user to be a player in the specified game
 * Expects gameId in req.params.gameId or req.body.gameId
 * @returns {Function} Express middleware function
 */
export function requireGamePlayer() {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    // Visitors cannot access games
    if (req.user.role === 'visitor') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Email verification required to access games'
      });
    }

    // Admin and owner can access any game
    if (req.user.role === 'admin' || req.user.role === 'owner') {
      return next();
    }

    const gameId = req.params.gameId || req.body.gameId;

    if (!gameId) {
      return res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Game ID is required'
      });
    }

    try {
      // Check if user is a player in the game
      const { rows } = await pool.query(
        'SELECT id FROM game_player WHERE game_id = $1 AND user_id = $2',
        [gameId, req.user.id]
      );

      if (rows.length === 0) {
        console.warn(`Authorization failed: User ${req.user.id} is not a player in game ${gameId}`);
        
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'You are not a player in this game'
        });
      }

      next();
    } catch (error) {
      console.error('Error checking game player:', error);
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to verify game player status'
      });
    }
  };
}

