import express from 'express';
import { getGame, getGamesByScenario, updateGameParams } from '../repos/gamesRepo.js';
import { listPlayers } from '../repos/playersRepo.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

export class DevRouter {
  constructor() {
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // All dev routes require admin or owner role
    // GET /api/dev/games/check/:scenario - Check for games with matching scenario
    this.router.get('/games/check/:scenario', authenticate, requireRole(['admin', 'owner']), this.checkGame.bind(this));
    
    // GET /api/dev/games/:gameId - Get game by ID
    this.router.get('/games/:gameId', authenticate, requireRole(['admin', 'owner']), this.getGameById.bind(this));
    
    // GET /api/dev/games/by-scenario/:scenario - Get games by scenario
    this.router.get('/games/by-scenario/:scenario', authenticate, requireRole(['admin', 'owner']), this.getGamesByScenario.bind(this));
    
    // GET /api/dev/games/:gameId/players - Get players for a game
    this.router.get('/games/:gameId/players', authenticate, requireRole(['admin', 'owner']), this.getGamePlayers.bind(this));
    
    // PUT /api/dev/games/:gameId/state - Update game state
    this.router.put('/games/:gameId/state', authenticate, requireRole(['admin', 'owner']), this.updateGameState.bind(this));
  }

  /**
   * GET /api/dev/games/check/:scenario
   * Check if there are any games with the given scenario title
   */
  async checkGame(req, res) {
    try {
      const { scenario } = req.params;
      
      if (!scenario) {
        return res.status(400).json({
          error: 'Missing scenario parameter'
        });
      }

      const games = await getGamesByScenario(scenario);
      
      if (games.length === 0) {
        // No games found
        return res.json({
          found: false,
          games: []
        });
      }

      if (games.length > 1) {
        // Multiple games found - this is an error condition
        return res.status(409).json({
          error: 'duplicateGames',
          scenario: scenario,
          message: `Multiple games found with title: ${scenario}`,
          count: games.length,
          games: games.map(g => ({ id: g.id, status: g.status }))
        });
      }

      // Single game found
      const game = games[0];
      
      // Parse the scenario state from params
      const scenarioState = game.params?.state || {};
      
      return res.json({
        found: true,
        game: {
          id: game.id,
          title: game.title,
          status: game.status,
          scenario: game.params?.scenario,
          state: scenarioState
        }
      });
    } catch (error) {
      console.error('Error checking game:', error);
      res.status(500).json({
        error: 'Failed to check game',
        details: error.message
      });
    }
  }

  /**
   * GET /api/dev/games/:gameId
   * Get game by ID
   */
  async getGameById(req, res) {
    try {
      const { gameId } = req.params;
      
      if (!gameId) {
        return res.status(400).json({
          error: 'Missing gameId parameter'
        });
      }

      const game = await getGame(gameId);
      
      if (!game) {
        return res.status(404).json({
          error: 'Game not found'
        });
      }

      res.json({
        success: true,
        game: game
      });

    } catch (error) {
      console.error('Error getting game by ID:', error);
      res.status(500).json({
        error: 'Failed to get game',
        details: error.message
      });
    }
  }

  /**
   * GET /api/dev/games/by-scenario/:scenario
   * Get games by scenario name
   */
  async getGamesByScenario(req, res) {
    try {
      const { scenario } = req.params;
      
      if (!scenario) {
        return res.status(400).json({
          error: 'Missing scenario parameter'
        });
      }

      const games = await getGamesByScenario(scenario);
      
      res.json({
        success: true,
        scenario: scenario,
        games: games
      });

    } catch (error) {
      console.error('Error getting games by scenario:', error);
      res.status(500).json({
        error: 'Failed to get games by scenario',
        details: error.message
      });
    }
  }

  /**
   * GET /api/dev/games/:gameId/players
   * Get all players for a specific game
   */
  async getGamePlayers(req, res) {
    try {
      const { gameId } = req.params;
      
      if (!gameId) {
        return res.status(400).json({
          error: 'Missing gameId parameter'
        });
      }

      const players = await listPlayers(gameId);
      
      res.json({
        success: true,
        gameId: gameId,
        players: players
      });

    } catch (error) {
      console.error('Error getting game players:', error);
      res.status(500).json({
        error: 'Failed to get game players',
        details: error.message
      });
    }
  }

  /**
   * PUT /api/dev/games/:gameId/state
   * Update game state for scenario progression
   */
  async updateGameState(req, res) {
    try {
      const { gameId } = req.params;
      const { state } = req.body;
      
      if (!gameId) {
        return res.status(400).json({
          error: 'Missing gameId parameter'
        });
      }

      if (!state) {
        return res.status(400).json({
          error: 'Missing state in request body'
        });
      }

      console.log(`🔄 DevRouter: Updating game state for ${gameId}:`, state);

      // Update the state in the params column
      const updatedGame = await updateGameParams({ 
        id: gameId, 
        newParams: { state } 
      });

      if (!updatedGame) {
        return res.status(404).json({
          error: 'Game not found'
        });
      }

      res.json({
        success: true,
        gameId: gameId,
        state: updatedGame.params.state
      });

    } catch (error) {
      console.error('❌ DevRouter: Error updating game state:', error);
      res.status(500).json({
        error: 'Failed to update game state',
        details: error.message
      });
    }
  }
}
