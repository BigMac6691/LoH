import express from 'express';
import { startGameFromSeed } from '../services/startGameService.js';
import { getOpenTurn } from '../repos/turnsRepo.js';
import { listPlayers } from '../repos/playersRepo.js';
import { listGames } from '../repos/gamesRepo.js';
import { pool } from '../db/pool.js';

export class GameRouter
{
  constructor()
  {
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes()
  {
    // POST /api/games - Create a new game
    this.router.post('/', this.createGame.bind(this));
    
    // GET /api/games - List all games
    this.router.get('/', this.listGames.bind(this));
    
    // GET /api/games/:gameId - Get specific game
    this.router.get('/:gameId', this.getGame.bind(this));
    
    // GET /api/games/:gameId/state - Get game state
    this.router.get('/:gameId/state', this.getGameState.bind(this));
    
    // GET /api/games/current - Get latest game (for development)
    this.router.get('/current/latest', this.getCurrentGame.bind(this));
  }

  /**
   * POST /api/games
   * Create a new game from seed with provided configuration
   */
  async createGame(req, res)
  {
    try
    {
      const { seed, mapSize, densityMin, densityMax, title, description, players, ownerId } = req.body;
      
      // Debug logging
      console.log('Received request body:', req.body);
      console.log('Extracted values:', { seed, mapSize, densityMin, densityMax, title, description, players, ownerId });
      
      // Validate required parameters
      if (!seed || !mapSize || densityMin === undefined || densityMax === undefined || !title || !description || !players || !ownerId)
      {
        return res.status(400).json({
          error: 'Missing required parameters: seed, mapSize, densityMin, densityMax, title, description, players, ownerId'
        });
      }
      
      const result = await startGameFromSeed({
        ownerId,
        seed,
        mapSize,
        densityMin,
        densityMax,
        title,
        description,
        players
      });
      
      res.json({
        success: true,
        gameId: result.game.id,
        turnId: result.turn.id,
        playerIds: result.players.map(p => p.id),
        counts: result.modelSummary
      });
      
    } catch (error)
    {
      console.error('Error starting game:', error);
      res.status(500).json({
        error: 'Failed to start game',
        details: error.message
      });
    }
  }

  /**
   * GET /api/games
   * List all games
   */
  async listGames(req, res)
  {
    try
    {
      const games = await listGames();
      res.json(games);
    } catch (error)
    {
      console.error('Error getting games list:', error);
      res.status(500).json({
        error: 'Failed to get games list',
        details: error.message
      });
    }
  }

  /**
   * GET /api/games/:gameId
   * Get specific game by ID
   */
  async getGame(req, res)
  {
    try
    {
      const { gameId } = req.params;
      
      // TODO: Implement getGame service
      const { rows } = await pool.query(
        'SELECT * FROM game WHERE id = $1',
        [gameId]
      );
      
      if (rows.length === 0)
      {
        return res.status(404).json({ error: 'Game not found' });
      }
      
      res.json(rows[0]);
    } catch (error)
    {
      console.error('Error getting game:', error);
      res.status(500).json({
        error: 'Failed to get game',
        details: error.message
      });
    }
  }

  /**
   * GET /api/games/:gameId/state
   * Get complete game state including stars, wormholes, star states, and ships
   */
  async getGameState(req, res)
  {
    try
    {
      const { gameId } = req.params;
      
      if (!gameId)
      {
        return res.status(400).json({ error: 'gameId parameter is required' });
      }
      
      // Get stars
      const { rows: stars } = await pool.query(
        `SELECT * FROM star WHERE game_id = $1 ORDER BY id`,
        [gameId]
      );
      
      // Get wormholes
      const { rows: wormholes } = await pool.query(
        `SELECT * FROM wormhole WHERE game_id = $1 ORDER BY id`,
        [gameId]
      );
      
      // Get star states
      const { rows: starStates } = await pool.query(
        `SELECT * FROM star_state WHERE game_id = $1 ORDER BY star_id`,
        [gameId]
      );
      
      // Get ships
      const { rows: ships } = await pool.query(
        `SELECT * FROM ship WHERE game_id = $1 ORDER BY id`,
        [gameId]
      );
      
      // Get players
      const { rows: players } = await pool.query(
        `SELECT * FROM game_player WHERE game_id = $1 ORDER BY name`,
        [gameId]
      );
      
      // Get game info (including map size)
      const { rows: games } = await pool.query(
        `SELECT map_size, seed, density_min, density_max FROM game WHERE id = $1`,
        [gameId]
      );
      
      const gameInfo = games.length > 0 ? games[0] : { map_size: 5, seed: 'default', density_min: 3, density_max: 7 };
      
      // Log the first few stars to inspect resource values
      console.log('🔍 Game State - Sample Stars with Resource Values:');
      stars.slice(0, 5).forEach((star, index) => {
        console.log(`  Star ${index + 1}: ID=${star.star_id}, Name=${star.name}, Resource=${star.resource}`);
      });
      console.log(`  Total stars: ${stars.length}`);
      console.log(`  Game map size: ${gameInfo.map_size}`);

      res.json({
        stars,
        wormholes,
        starStates,
        ships,
        players,
        gameInfo,
        counts: {
          stars: stars.length,
          wormholes: wormholes.length,
          starStates: starStates.length,
          ships: ships.length,
          players: players.length
        }
      });
      
    } catch (error)
    {
      console.error('Error getting game state:', error);
      res.status(500).json({
        error: 'Failed to get game state',
        details: error.message
      });
    }
  }

  /**
   * GET /api/games/current/latest
   * Get the latest game with open turn and players (for development)
   */
  async getCurrentGame(req, res)
  {
    try
    {
      // Get the most recently created game
      const { rows: games } = await pool.query(
        `SELECT * FROM game ORDER BY created_at DESC LIMIT 1`
      );
      
      if (games.length === 0)
      {
        return res.status(404).json({ error: 'No games found' });
      }
      
      const game = games[0];
      const turn = await getOpenTurn(game.id);
      const players = await listPlayers(game.id);
      
      res.json({
        game,
        turn,
        players
      });
      
    } catch (error)
    {
      console.error('Error getting current game:', error);
      res.status(500).json({
        error: 'Failed to get current game',
        details: error.message
      });
    }
  }

  getRouter()
  {
    return this.router;
  }
}
