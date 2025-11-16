/**
 * SystemEventRouter - Routes for managing system events/news
 * Requires: admin or owner role
 */

import express from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { sanitizeInput } from '../utils/security.js';

export class SystemEventRouter {
  constructor() {
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Public read-only endpoint - all authenticated users can view news
    // GET /api/system-events - List system events with pagination (authenticated users only)
    this.router.get('/', authenticate, this.listEvents.bind(this));
    
    // GET /api/system-events/:eventId - Get a specific event (authenticated users only)
    this.router.get('/:eventId', authenticate, this.getEvent.bind(this));
    
    // Admin-only write endpoints
    // POST /api/system-events - Create a new event (admin/owner only)
    this.router.post('/', authenticate, requireRole(['admin', 'owner']), this.createEvent.bind(this));
    
    // PUT /api/system-events/:eventId - Update an event (admin/owner only)
    this.router.put('/:eventId', authenticate, requireRole(['admin', 'owner']), this.updateEvent.bind(this));
    
    // DELETE /api/system-events/:eventId - Delete an event (admin/owner only)
    this.router.delete('/:eventId', authenticate, requireRole(['admin', 'owner']), this.deleteEvent.bind(this));
  }

  /**
   * Get the Express router instance
   * @returns {express.Router} The router instance
   */
  getRouter() {
    return this.router;
  }

  /**
   * GET /api/system-events
   * List system events with pagination
   * Query params: page (default 1), limit (default 5)
   */
  async listEvents(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 5;
      const offset = (page - 1) * limit;

      // Get total count
      const { rows: countRows } = await pool.query(
        'SELECT COUNT(*) as total FROM system_event'
      );
      const total = parseInt(countRows[0].total);
      const totalPages = Math.ceil(total / limit);

      // Get events with creator info
      const { rows } = await pool.query(
        `SELECT 
          se.id,
          se.created_at,
          se.text,
          se.creator_id,
          u.display_name as creator_name,
          u.email as creator_email
        FROM system_event se
        LEFT JOIN app_user u ON se.creator_id = u.id
        ORDER BY se.created_at DESC
        LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      res.json({
        success: true,
        events: rows,
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
      console.error('Error listing system events:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to list system events'
      });
    }
  }

  /**
   * GET /api/system-events/:eventId
   * Get a specific event
   */
  async getEvent(req, res) {
    try {
      const { eventId } = req.params;

      const { rows } = await pool.query(
        `SELECT 
          se.id,
          se.created_at,
          se.text,
          se.creator_id,
          u.display_name as creator_name,
          u.email as creator_email
        FROM system_event se
        LEFT JOIN app_user u ON se.creator_id = u.id
        WHERE se.id = $1`,
        [eventId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'System event not found'
        });
      }

      res.json({
        success: true,
        event: rows[0]
      });
    } catch (error) {
      console.error('Error getting system event:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to get system event'
      });
    }
  }

  /**
   * POST /api/system-events
   * Create a new event
   */
  async createEvent(req, res) {
    try {
      const { text } = req.body;

      // Validate required fields
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'Text is required'
        });
      }

      // Validate length (max 1024 characters / 1KB)
      if (text.length > 1024) {
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'Text cannot exceed 1024 characters (1KB)'
        });
      }

      // Sanitize input
      const sanitizedText = sanitizeInput(text.trim());

      // Create event
      const { rows } = await pool.query(
        `INSERT INTO system_event (id, created_at, creator_id, text)
         VALUES (gen_random_uuid(), NOW(), $1, $2)
         RETURNING id, created_at, text, creator_id`,
        [req.user.id, sanitizedText]
      );

      // Get creator info
      const { rows: creatorRows } = await pool.query(
        `SELECT display_name, email FROM app_user WHERE id = $1`,
        [req.user.id]
      );

      res.status(201).json({
        success: true,
        message: 'System event created successfully',
        event: {
          ...rows[0],
          creator_name: creatorRows[0]?.display_name || null,
          creator_email: creatorRows[0]?.email || null
        }
      });
    } catch (error) {
      console.error('Error creating system event:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to create system event'
      });
    }
  }

  /**
   * PUT /api/system-events/:eventId
   * Update an event
   */
  async updateEvent(req, res) {
    try {
      const { eventId } = req.params;
      const { text } = req.body;

      // Validate required fields
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'Text is required'
        });
      }

      // Validate length (max 1024 characters / 1KB)
      if (text.length > 1024) {
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: 'Text cannot exceed 1024 characters (1KB)'
        });
      }

      // Sanitize input
      const sanitizedText = sanitizeInput(text.trim());

      // Update event
      const { rows } = await pool.query(
        `UPDATE system_event
         SET text = $1
         WHERE id = $2
         RETURNING id, created_at, text, creator_id`,
        [sanitizedText, eventId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'System event not found'
        });
      }

      // Get creator info
      const { rows: creatorRows } = await pool.query(
        `SELECT display_name, email FROM app_user WHERE id = $1`,
        [rows[0].creator_id]
      );

      res.json({
        success: true,
        message: 'System event updated successfully',
        event: {
          ...rows[0],
          creator_name: creatorRows[0]?.display_name || null,
          creator_email: creatorRows[0]?.email || null
        }
      });
    } catch (error) {
      console.error('Error updating system event:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to update system event'
      });
    }
  }

  /**
   * DELETE /api/system-events/:eventId
   * Delete an event
   */
  async deleteEvent(req, res) {
    try {
      const { eventId } = req.params;

      const { rowCount } = await pool.query(
        'DELETE FROM system_event WHERE id = $1',
        [eventId]
      );

      if (rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'System event not found'
        });
      }

      res.json({
        success: true,
        message: 'System event deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting system event:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to delete system event'
      });
    }
  }
}

