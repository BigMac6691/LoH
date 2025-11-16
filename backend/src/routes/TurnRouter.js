import express from 'express';
import { TurnService } from '../services/TurnService.js';
import { authenticate } from '../middleware/auth.js';
import { requireGamePlayer } from '../middleware/rbac.js';

export class TurnRouter
{
  constructor()
  {
    this.router = express.Router();
    this.turnService = new TurnService();
    this.setupRoutes();
  }

  setupRoutes()
  {
    // POST /api/turns/end-turn - End a player's turn (requires auth and game player)
    this.router.post('/end-turn', authenticate, requireGamePlayer(), this.endTurn.bind(this));
    
    // GET /api/turns/players/:gameId - Get all players turn status (requires auth)
    this.router.get('/players/:gameId', authenticate, this.getPlayersTurnStatus.bind(this));
    
    // POST /api/turns/reset/:gameId - Reset all players for new turn (requires auth and game player)
    this.router.post('/reset/:gameId', authenticate, requireGamePlayer(), this.resetPlayersForNewTurn.bind(this));
  }

  /**
   * POST /api/turns/end-turn
   * End a player's turn by setting their status to "waiting"
   */
  async endTurn(req, res)
  {
    try
    {
      const { gameId, playerId } = req.body;
      
      // Validate required parameters
      if (!gameId || !playerId)
      {
        return res.status(400).json({
          error: 'Missing required parameters: gameId, playerId'
        });
      }

      // End the player's turn
      const result = await this.turnService.endPlayerTurn(gameId, playerId);

      res.json({
        success: true,
        ...result
      });

    } catch (error)
    {
      console.error('Error ending turn:', error);
      res.status(500).json({
        error: 'Failed to end turn',
        details: error.message
      });
    }
  }

  /**
   * GET /api/turns/players/:gameId
   * Get all players and their current turn status for a game
   */
  async getPlayersTurnStatus(req, res)
  {
    try
    {
      const { gameId } = req.params;
      
      if (!gameId)
      {
        return res.status(400).json({
          error: 'Missing required parameter: gameId'
        });
      }

      const players = await this.turnService.getPlayersTurnStatus(gameId);

      res.json({
        success: true,
        players
      });

    } catch (error)
    {
      console.error('Error getting players turn status:', error);
      res.status(500).json({
        error: 'Failed to get players turn status',
        details: error.message
      });
    }
  }

  /**
   * POST /api/turns/reset/:gameId
   * Reset all players to "active" status for a new turn
   */
  async resetPlayersForNewTurn(req, res)
  {
    try
    {
      const { gameId } = req.params;
      
      if (!gameId)
      {
        return res.status(400).json({
          error: 'Missing required parameter: gameId'
        });
      }

      const result = await this.turnService.resetPlayersForNewTurn(gameId);

      res.json({
        success: true,
        ...result
      });

    } catch (error)
    {
      console.error('Error resetting players for new turn:', error);
      res.status(500).json({
        error: 'Failed to reset players for new turn',
        details: error.message
      });
    }
  }

  /**
   * Get the Express router instance
   * @returns {express.Router} The router instance
   */
  getRouter()
  {
    return this.router;
  }
}
