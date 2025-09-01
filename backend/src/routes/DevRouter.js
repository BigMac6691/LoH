import express from 'express';
import { getGamesByTitle } from '../repos/gamesRepo.js';

export class DevRouter {
  constructor() {
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // GET /api/dev/games/check/:scenario - Check for games with matching title
    this.router.get('/games/check/:scenario', this.checkGame.bind(this));
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

      const games = await getGamesByTitle(scenario);
      
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
      return res.json({
        found: true,
        gameId: game.id,
        status: game.status,
        game: game
      });

    } catch (error) {
      console.error('Error checking game:', error);
      res.status(500).json({
        error: 'Failed to check game',
        details: error.message
      });
    }
  }
}
