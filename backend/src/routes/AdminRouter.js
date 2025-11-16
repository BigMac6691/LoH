/**
 * AdminRouter - Admin-only routes for user and system management
 * Requires: admin or owner role
 */

import express from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { generateSecureToken, getClientIp, sanitizeInput, sanitizeEmail, validateEmail } from '../utils/security.js';

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
    
    // PUT /api/admin/users/:userId - Update user fields (email, display_name, status, role, email_verified)
    this.router.put('/users/:userId', authenticate, requireRole(['admin', 'owner']), this.updateUser.bind(this));
    
    // PUT /api/admin/users/:userId/role - Update user role (kept for backward compatibility)
    this.router.put('/users/:userId/role', authenticate, requireRole(['admin', 'owner']), this.updateUserRole.bind(this));
    
    // PUT /api/admin/users/:userId/status - Update user status (kept for backward compatibility)
    this.router.put('/users/:userId/status', authenticate, requireRole(['admin', 'owner']), this.updateUserStatus.bind(this));
    
    // POST /api/admin/users/:userId/reset-password - Reset user password
    this.router.post('/users/:userId/reset-password', authenticate, requireRole(['admin', 'owner']), this.resetUserPassword.bind(this));
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
   * Query params: page (default 1), limit (default 20)
   */
  async listUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      // Get total count
      const { rows: countRows } = await pool.query(
        'SELECT COUNT(*) as total FROM app_user'
      );
      const total = parseInt(countRows[0].total);
      const totalPages = Math.ceil(total / limit);

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
        [limit, offset]
      );

      res.json({
        success: true,
        users: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
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

  /**
   * PUT /api/admin/users/:userId
   * Update user fields (email, display_name, status, role, email_verified) (admin/owner only)
   */
  async updateUser(req, res) {
    try {
      const { userId } = req.params;
      const { email, display_name, status, role, email_verified } = req.body;

      // Build update query dynamically based on provided fields
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (email !== undefined) {
        // Validate email
        const sanitizedEmail = sanitizeEmail(email);
        if (!validateEmail(sanitizedEmail)) {
          return res.status(400).json({
            success: false,
            error: 'BAD_REQUEST',
            message: 'Invalid email format'
          });
        }
        updates.push(`email = $${paramIndex++}`);
        values.push(sanitizedEmail);
      }

      if (display_name !== undefined) {
        const sanitizedDisplayName = sanitizeInput(display_name.trim());
        if (!sanitizedDisplayName || sanitizedDisplayName.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'BAD_REQUEST',
            message: 'Display name cannot be empty'
          });
        }
        updates.push(`display_name = $${paramIndex++}`);
        values.push(sanitizedDisplayName);
      }

      if (status !== undefined) {
        const validStatuses = ['active', 'suspended', 'deleted'];
        if (!validStatuses.includes(status)) {
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
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      if (role !== undefined) {
        const validRoles = ['player', 'sponsor', 'admin', 'owner'];
        if (!validRoles.includes(role)) {
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
        // Prevent users from changing their own role (unless they're owner)
        if (userId === req.user.id && req.user.role !== 'owner') {
          return res.status(403).json({
            success: false,
            error: 'FORBIDDEN',
            message: 'You cannot change your own role'
          });
        }
        updates.push(`role = $${paramIndex++}`);
        values.push(role);
      }

      if (email_verified !== undefined) {
        if (typeof email_verified !== 'boolean') {
          return res.status(400).json({
            success: false,
            error: 'BAD_REQUEST',
            message: 'email_verified must be a boolean'
          });
        }
        updates.push(`email_verified = $${paramIndex++}`);
        values.push(email_verified);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'No fields to update'
        });
      }

      // Add updated_at
      updates.push(`updated_at = NOW()`);
      values.push(userId);

      // Update user
      const { rows } = await pool.query(
        `UPDATE app_user 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, email, display_name, role, status, email_verified, created_at, updated_at`,
        values
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
        message: 'User updated successfully',
        user: rows[0]
      });
    } catch (error) {
      console.error('Error updating user:', error);
      
      // Handle unique constraint violation (duplicate email)
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'Email address is already in use'
        });
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to update user'
      });
    }
  }

  /**
   * POST /api/admin/users/:userId/reset-password
   * Reset user password (admin/owner only) - generates recovery token like password recovery
   */
  async resetUserPassword(req, res) {
    try {
      const { userId } = req.params;

      // Check if user exists
      const { rows: userRows } = await pool.query(
        'SELECT id, email FROM app_user WHERE id = $1',
        [userId]
      );

      if (userRows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      const user = userRows[0];

      // Generate recovery token (same as password recovery flow)
      const recoveryToken = generateSecureToken(32);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour

      // Delete old unused tokens
      await pool.query(
        'DELETE FROM password_recovery_token WHERE user_id = $1 AND used_at IS NULL',
        [user.id]
      );

      // Store recovery token
      await pool.query(
        `INSERT INTO password_recovery_token (id, user_id, token, expires_at, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [randomUUID(), user.id, recoveryToken, expiresAt, getClientIp(req)]
      );

      // TODO: Send recovery email
      console.log(`Password reset token for ${user.email}: ${recoveryToken} (expires: ${expiresAt})`);

      res.json({
        success: true,
        message: 'Password reset token generated successfully',
        recoveryToken: process.env.NODE_ENV === 'development' ? recoveryToken : undefined,
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      console.error('Error resetting user password:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to reset user password'
      });
    }
  }
}

