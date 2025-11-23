// backend/src/routes/TurnEventRouter.js
import express from 'express';
import { TurnEventService } from '../services/TurnEventService.js';

const router = express.Router();
const turnEventService = new TurnEventService();

/**
 * GET /api/turn-events/:gameId/:turnId/player/:playerId
 * Get turn events for a specific player
 */
router.get('/:gameId/:turnId/player/:playerId', async (req, res) => {
  try {
    const { gameId, turnId, playerId } = req.params;
    const { kind } = req.query;
    
    const result = await turnEventService.getPlayerTurnEvents(gameId, turnId, playerId, kind);
    
    res.json(result);
  } catch (error) {
    console.error('TurnEventRouter: Error getting player turn events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get player turn events',
      message: error.message
    });
  }
});

/**
 * GET /api/turn-events/:gameId/:turnId/all
 * Get all turn events for a turn (admin view)
 */
router.get('/:gameId/:turnId/all', async (req, res) => {
  try {
    const { gameId, turnId } = req.params;
    const { kind } = req.query;
    
    const result = await turnEventService.getAllTurnEvents(gameId, turnId, kind);
    
    res.json(result);
  } catch (error) {
    console.error('TurnEventRouter: Error getting all turn events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get all turn events',
      message: error.message
    });
  }
});

/**
 * GET /api/turn-events/:gameId/by-kind/:kind
 * Get turn events by kind across multiple turns
 */
router.get('/:gameId/by-kind/:kind', async (req, res) => {
  try {
    const { gameId, kind } = req.params;
    const { playerId, limit } = req.query;
    
    const result = await turnEventService.getEventsByKind(
      gameId, 
      playerId || null, 
      kind, 
      limit ? parseInt(limit) : 100
    );
    
    res.json(result);
  } catch (error) {
    console.error('TurnEventRouter: Error getting events by kind:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get events by kind',
      message: error.message
    });
  }
});

export default router;
