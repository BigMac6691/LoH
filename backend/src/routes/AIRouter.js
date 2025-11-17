/**
 * AIRouter - API routes for AI management
 * Provides endpoints for listing available AIs and their configurations
 */

import express from 'express';
import { aiRegistry } from '../ai/index.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

export class AIRouter {
  constructor() {
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Get list of available AIs with their schemas and descriptions
    // Public endpoint for authenticated users (needed for game creation)
    this.router.get('/list', authenticate, async (req, res) => {
      try {
        const ais = aiRegistry.listAIsWithInfo();
        res.json({
          success: true,
          ais
        });
      } catch (error) {
        console.error('Error listing AIs:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to list AIs',
          message: error.message
        });
      }
    });

    // Get schema for a specific AI
    this.router.get('/schema/:aiName', authenticate, async (req, res) => {
      try {
        const { aiName } = req.params;
        const schema = aiRegistry.getAISchema(aiName);
        
        if (!schema) {
          return res.status(404).json({
            success: false,
            error: `AI '${aiName}' not found`
          });
        }

        res.json({
          success: true,
          aiName,
          schema
        });
      } catch (error) {
        console.error('Error getting AI schema:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get AI schema',
          message: error.message
        });
      }
    });
  }

  getRouter() {
    return this.router;
  }
}

