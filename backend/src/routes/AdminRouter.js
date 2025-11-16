/**
 * AdminRouter - Admin-only routes for user and system management
 * Requires: admin or owner role
 */

import express from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

export class AdminRouter {
  constructor() {
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // All admin routes require admin or owner role
    // GET /api/admin/users - List all users
    this.router.get('/users', authenticate, requireRole(['admin', 'owner']), this.listUsers.bind(this));
    
    // GET /api/admin/users/:userId - Get user details
    this.router.get('/users/:userId', authenticate, requireRole(['admin', 'owner']), this.getUser.bind(this));
    
    // PUT /api/admin/users/:userId/role - Update user role
    this.router.put('/users/:userId/role', authenticate, requireRole(['admin', 'owner']), this.updateUserRole.bind(this));
    
    // PUT /api/admin/users/:userId/status - Update user status
    this.router.put('/users/:userId/status', authenticate, requireRole(['admin', 'owner']), this.updateUserStatus.bind(this));
  }

  /**
   * Get the Express router instance
   * @returns {express.Router} The router instance
   */
  getRouter() {
    return this.router;
  }

  /**
   * GET /api/admin/users
   * List all users (admin/owner only)
   */
  async listUsers(req, res) {
    try {
      const { limit = 100, offset = 0 } = req.query;

      const { rows } = await pool.query(
        `SELECT 
          id,
          email,
          display_name,
          role,
          status,
          email_verified,
          created_at,
          updated_at
        FROM app_user
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`,
        [parseInt(limit), parseInt(offset)]
      );

      // Get total count
      const { rows: countRows } = await pool.query(
        'SELECT COUNT(*) as total FROM app_user'
      );

      res.json({
        success: true,
        users: rows,
        total: parseInt(countRows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      console.error('Error listing users:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to list users'
      });
    }
  }

  /**
   * GET /api/admin/users/:userId
   * Get user details (admin/owner only)
   */
  async getUser(req, res) {
    try {
      const { userId } = req.params;

      const { rows } = await pool.query(
        `SELECT 
          id,
          email,
          display_name,
          role,
          status,
          email_verified,
          created_at,
          updated_at
        FROM app_user
        WHERE id = $1`,
        [userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        user: rows[0]
      });
    } catch (error) {
      console.error('Error getting user:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to get user'
      });
    }
  }

  /**
   * PUT /api/admin/users/:userId/role
   * Update user role (admin/owner only)
   */
  async updateUserRole(req, res) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      // Validate role
      const validRoles = ['player', 'sponsor', 'admin', 'owner'];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        });
      }

      // Prevent changing owner role (only one owner allowed)
      if (role === 'owner') {
        const { rows: existingOwner } = await pool.query(
          'SELECT id FROM app_user WHERE role = $1 AND id != $2',
          ['owner', userId]
        );

        if (existingOwner.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'BAD_REQUEST',
            message: 'Another user already has the owner role. Only one owner is allowed.'
          });
        }
      }

      // Prevent users from changing their own role
      if (userId === req.user.id && req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'You cannot change your own role'
        });
      }

      // Update role
      const { rows } = await pool.query(
        `UPDATE app_user 
         SET role = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, email, display_name, role, status, email_verified, created_at, updated_at`,
        [role, userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User role updated successfully',
        user: rows[0]
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      
      // Handle unique constraint violation for owner role
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'Another user already has the owner role. Only one owner is allowed.'
        });
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to update user role'
      });
    }
  }

  /**
   * PUT /api/admin/users/:userId/status
   * Update user status (admin/owner only)
   */
  async updateUserStatus(req, res) {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      // Validate status
      const validStatuses = ['active', 'suspended', 'deleted'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      // Prevent users from changing their own status
      if (userId === req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'You cannot change your own status'
        });
      }

      // Update status
      const { rows } = await pool.query(
        `UPDATE app_user 
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, email, display_name, role, status, email_verified, created_at, updated_at`,
        [status, userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User status updated successfully',
        user: rows[0]
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to update user status'
      });
    }
  }
}

