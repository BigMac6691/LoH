import express from 'express';
import { createEmptyGame, generateMapForGame, placePlayersForGame } from '../services/startGameService.js';
import { getOpenTurn, openTurn } from '../repos/turnsRepo.js';
import { listPlayers } from '../repos/playersRepo.js';
import { listGames } from '../repos/gamesRepo.js';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole, requireGameOwnerOrAdmin, requireGamePlayer } from '../middleware/rbac.js';

export class GameRouter
{
  constructor()
  {
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes()
  {
    // POST /api/games - Create a new game (sponsor, admin, owner only)
    this.router.post('/', authenticate, requireRole(['sponsor', 'admin', 'owner']), this.createGame.bind(this));
    
    // GET /api/games - List all games (authenticated users only)
    this.router.get('/', authenticate, this.listGames.bind(this));
    
    // GET /api/games/playing - Get games where current user is a player
    this.router.get('/playing', authenticate, this.getGamesPlaying.bind(this));
    
    // GET /api/games/available - Get games available for current user to join
    this.router.get('/available', authenticate, this.getGamesAvailable.bind(this));
    
    // POST /api/games/:gameId/join - Join a game
    this.router.post('/:gameId/join', authenticate, this.joinGame.bind(this));
    
    // GET /api/games/:gameId - Get specific game (authenticated users only)
    this.router.get('/:gameId', authenticate, this.getGame.bind(this));
    
    // GET /api/games/:gameId/state - Get game state (authenticated users only)
    this.router.get('/:gameId/state', authenticate, this.getGameState.bind(this));
    
    // GET /api/games/current - Get latest game (for development, authenticated users only)
    this.router.get('/current/latest', authenticate, this.getCurrentGame.bind(this));
    
    // POST /api/games/players - Add a player to a game (sponsor, admin, owner only)
    this.router.post('/players', authenticate, requireRole(['sponsor', 'admin', 'owner']), this.addPlayer.bind(this));
    
    // POST /api/games/:gameId/generate-map - Generate map for a game (owner or admin only)
    this.router.post('/:gameId/generate-map', authenticate, requireGameOwnerOrAdmin(), this.generateMap.bind(this));
    
    // POST /api/games/:gameId/place-players - Place players on the map (owner or admin only)
    this.router.post('/:gameId/place-players', authenticate, requireGameOwnerOrAdmin(), this.placePlayers.bind(this));
    
    // GET /api/games/:gameId/turn/open - Get open turn for a game (authenticated users only)
    this.router.get('/:gameId/turn/open', authenticate, this.getOpenTurn.bind(this));
    
    // POST /api/games/:gameId/turn - Create a new turn for a game (owner or admin only)
    this.router.post('/:gameId/turn', authenticate, requireGameOwnerOrAdmin(), this.createTurn.bind(this));
    
    // GET /api/games/:gameId/turns - Get all turns for a game (authenticated users only)
    this.router.get('/:gameId/turns', authenticate, this.getTurns.bind(this));
  }

  /**
   * POST /api/games
   * Create a new game from seed with provided configuration
   * Requires: sponsor, admin, or owner role
   */
  async createGame(req, res)
  {
    try
    {
      const { seed, mapSize, densityMin, densityMax, title, description, status, params } = req.body;
      
      // Use authenticated user ID as owner
      const ownerId = req.user.id;
      
      // Debug logging
      console.log('Received request body:', req.body);
      console.log('Extracted values:', { seed, mapSize, densityMin, densityMax, title, description, status, ownerId, params });
      
      // Validate required parameters
      if (!seed || !mapSize || densityMin === undefined || densityMax === undefined || !title || !description || !status || !ownerId)
      {
        return res.status(400).json({
          error: 'Missing required parameters: seed, mapSize, densityMin, densityMax, title, description, status, ownerId'
        });
      }
      
      const result = await createEmptyGame({
        ownerId,
        seed,
        mapSize,
        densityMin,
        densityMax,
        title,
        description,
        status: status || 'lobby',
        params: params || {}
      });
      
      res.json({
        success: true,
        gameId: result.game.id
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
   * GET /api/games/playing
   * Get games where current user is a player
   * Query params: userId (will use JWT in Phase 1)
   */
  async getGamesPlaying(req, res)
  {
    try
    {
      // Use authenticated user ID from JWT
      const userId = req.user.id;

      // Get games where user is a player, with owner info and latest turn
      const { rows } = await pool.query(
        `SELECT 
          g.*,
          u.display_name as owner_display_name,
          COALESCE(gt.number, 0) as current_turn_number,
          gp.status as player_status
        FROM game g
        INNER JOIN game_player gp ON g.id = gp.game_id
        LEFT JOIN app_user u ON g.owner_id = u.id
        LEFT JOIN LATERAL (
          SELECT number 
          FROM game_turn 
          WHERE game_id = g.id 
          ORDER BY number DESC 
          LIMIT 1
        ) gt ON true
        WHERE gp.user_id = $1
        ORDER BY g.created_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        games: rows
      });
    }
    catch (error)
    {
      console.error('Error getting games playing:', error);
      res.status(500).json({
        error: 'Failed to get games playing',
        details: error.message
      });
    }
  }

  /**
   * GET /api/games/available
   * Get games available for current user to join
   * Query params: userId (will use JWT in Phase 1)
   */
  async getGamesAvailable(req, res)
  {
    try
    {
      // Use authenticated user ID from JWT
      const userId = req.user.id;

      // Get games where user is NOT a player, with player count and owner info
      const { rows } = await pool.query(
        `SELECT 
          g.*,
          u.display_name as owner_display_name,
          COALESCE(player_counts.player_count, 0) as player_count
        FROM game g
        LEFT JOIN app_user u ON g.owner_id = u.id
        LEFT JOIN LATERAL (
          SELECT COUNT(*) as player_count
          FROM game_player
          WHERE game_id = g.id
        ) player_counts ON true
        LEFT JOIN game_player gp ON g.id = gp.game_id AND gp.user_id = $1
        WHERE gp.user_id IS NULL
          AND g.status IN ('lobby', 'running')
          AND COALESCE(player_counts.player_count, 0) < g.max_players
        ORDER BY g.created_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        games: rows
      });
    }
    catch (error)
    {
      console.error('Error getting games available:', error);
      res.status(500).json({
        error: 'Failed to get games available',
        details: error.message
      });
    }
  }

  /**
   * POST /api/games/:gameId/join
   * Join a game (add current user as a player)
   * Body: { userId, name, colorHex } (will use JWT in Phase 1)
   */
  async joinGame(req, res)
  {
    try
    {
      const { gameId } = req.params;
      const { name, colorHex } = req.body;
      
      // Use authenticated user ID from JWT
      const userId = req.user.id;
      
      if (!gameId) {
        return res.status(400).json({
          error: 'Game ID is required'
        });
      }

      // Check if game exists and has space
      const { rows: gameRows } = await pool.query(
        `SELECT g.*, 
         COUNT(gp.id) as player_count
         FROM game g
         LEFT JOIN game_player gp ON g.id = gp.game_id
         WHERE g.id = $1
         GROUP BY g.id`,
        [gameId]
      );

      if (gameRows.length === 0) {
        return res.status(404).json({
          error: 'Game not found'
        });
      }

      const game = gameRows[0];
      
      if (parseInt(game.player_count) >= parseInt(game.max_players)) {
        return res.status(400).json({
          error: 'Game is full'
        });
      }

      // Check if user is already in the game
      const { rows: existingPlayer } = await pool.query(
        `SELECT id FROM game_player WHERE game_id = $1 AND user_id = $2`,
        [gameId, userId]
      );

      if (existingPlayer.length > 0) {
        return res.status(400).json({
          error: 'User is already in this game'
        });
      }

      // Get user info for default name if not provided
      if (!name || !colorHex) {
        const { rows: userRows } = await pool.query(
          `SELECT display_name FROM app_user WHERE id = $1`,
          [userId]
        );
        
        if (userRows.length === 0) {
          return res.status(404).json({
            error: 'User not found'
          });
        }

        const playerName = name || userRows[0].display_name;
        // Generate a default color if not provided
        const colors = ['#ff4444', '#4444ff', '#44ff44', '#ffff44', '#ff44ff', '#44ffff'];
        const existingColors = await pool.query(
          `SELECT color_hex FROM game_player WHERE game_id = $1`,
          [gameId]
        );
        const usedColors = existingColors.rows.map(r => r.color_hex);
        const availableColor = colors.find(c => !usedColors.includes(c)) || colors[0];
        const playerColorHex = colorHex || availableColor;

        // Add player to game
        const { addPlayer: addPlayerToGame } = await import('../repos/playersRepo.js');
        const result = await addPlayerToGame({
          gameId,
          userId,
          name: playerName,
          colorHex: playerColorHex,
          countryName: null,
          meta: {}
        });

        return res.json({
          success: true,
          message: 'Successfully joined game',
          player: {
            id: result.id,
            name: result.name,
            colorHex: result.color_hex
          }
        });
      }

      // Add player with provided name and color
      const { addPlayer: addPlayerToGame } = await import('../repos/playersRepo.js');
      const result = await addPlayerToGame({
        gameId,
        userId,
        name,
        colorHex,
        countryName: null,
        meta: {}
      });

      res.json({
        success: true,
        message: 'Successfully joined game',
        player: {
          id: result.id,
          name: result.name,
          colorHex: result.color_hex
        }
      });

    }
    catch (error)
    {
      console.error('Error joining game:', error);
      
      // Handle duplicate key errors
      if (error.code === '23505') {
        return res.status(400).json({
          error: 'Name or color already taken in this game'
        });
      }

      res.status(500).json({
        error: 'Failed to join game',
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

  /**
   * POST /api/games/players
   * Add a player to a game
   */
  async addPlayer(req, res) {
    try {
      const { gameId, userId, name, colorHex, countryName, meta } = req.body;
      
      // Debug logging
      console.log('Received add player request body:', req.body);
      console.log('Extracted values:', { gameId, userId, name, colorHex, countryName, meta });
      
      // Validate required parameters
      if (!gameId || !name || !colorHex) {
        return res.status(400).json({
          error: 'Missing required parameters: gameId, name, colorHex'
        });
      }
      
      // Import the addPlayer function from playersRepo
      const { addPlayer: addPlayerToGame } = await import('../repos/playersRepo.js');
      
      const result = await addPlayerToGame({
        gameId,
        userId,
        name,
        colorHex,
        countryName,
        meta: meta || {}
      });
      
      res.json({
        success: true,
        id: result.id,
        gameId: result.game_id,
        name: result.name,
        colorHex: result.color_hex,
        countryName: result.country_name
      });
      
    } catch (error) {
      console.error('Error adding player:', error);
      res.status(500).json({
        error: 'Failed to add player',
        details: error.message
      });
    }
  }

  /**
   * POST /api/games/:gameId/generate-map
   * Generate map for a game (stars and wormholes only)
   */
  async generateMap(req, res) {
    try {
      const { gameId } = req.params;
      
      // Debug logging
      console.log('Received generate map request for gameId:', gameId);
      
      // Validate required parameters
      if (!gameId) {
        return res.status(400).json({
          error: 'Missing required parameter: gameId'
        });
      }
      
      const result = await generateMapForGame({
        gameId
      });
      
      res.json({
        success: true,
        gameId: result.gameId,
        starsCount: result.starsCount,
        wormholesCount: result.wormholesCount,
        modelSummary: result.modelSummary
      });
      
    } catch (error) {
      console.error('Error generating map:', error);
      res.status(500).json({
        error: 'Failed to generate map',
        details: error.message
      });
    }
  }

  /**
   * POST /api/games/:gameId/place-players
   * Place players on the map for a game
   */
  async placePlayers(req, res)
  {
    try
    {
      const { gameId } = req.params;
      
      if (!gameId)
      {
        return res.status(400).json({
          error: 'Missing gameId parameter'
        });
      }
      
      console.log(`🎮 GameRouter: Placing players for game: ${gameId}`);
      
      // Call the service to place players
      const result = await placePlayersForGame({ gameId });
      
      res.json({
        success: true,
        gameId: gameId,
        playersPlaced: result.playersPlaced
      });
      
    } catch (error) {
      console.error('Error placing players:', error);
      res.status(500).json({
        error: 'Failed to place players',
        details: error.message
      });
    }
  }

  /**
   * GET /api/games/:gameId/turn/open
   * Get the currently open turn for a game
   */
  async getOpenTurn(req, res)
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

      const turn = await getOpenTurn(gameId);
      
      if (turn)
      {
        res.json({
          success: true,
          turn: turn
        });
      }
      else
      {
        res.json({
          success: true,
          turn: null
        });
      }

    } catch (error)
    {
      console.error('Error getting open turn:', error);
      res.status(500).json({
        error: 'Failed to get open turn',
        details: error.message
      });
    }
  }

  /**
   * POST /api/games/:gameId/turn
   * Create a new turn for a game
   */
  async createTurn(req, res)
  {
    try
    {
      const { gameId } = req.params;
      const { number } = req.body;
      
      if (!gameId)
      {
        return res.status(400).json({
          error: 'Missing required parameter: gameId'
        });
      }

      if (!number)
      {
        return res.status(400).json({
          error: 'Missing required parameter: number'
        });
      }

      const turn = await openTurn({ gameId, number });
      
      res.json({
        success: true,
        turn: turn
      });

    } catch (error)
    {
      console.error('Error creating turn:', error);
      res.status(500).json({
        error: 'Failed to create turn',
        details: error.message
      });
    }
  }

  /**
   * GET /api/games/:gameId/turns
   * Get all turns for a game
   */
  async getTurns(req, res)
  {
    try
    {
      const { gameId } = req.params;
      
      if (!gameId)
      {
        return res.status(400).json({
          error: 'Game ID is required'
        });
      }

      // Get all turns for the game, ordered by number
      const { rows: turns } = await pool.query(
        `SELECT id, number, status, opened_at, closed_at
         FROM game_turn 
         WHERE game_id = $1
         ORDER BY number ASC`,
        [gameId]
      );

      res.json({
        success: true,
        turns: turns
      });

    }
    catch (error)
    {
      console.error('Error getting turns:', error);
      res.status(500).json({
        error: 'Failed to get turns',
        details: error.message
      });
    }
  }

  getRouter()
  {
    return this.router;
  }
}
