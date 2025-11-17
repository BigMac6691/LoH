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
    
    // Game management endpoints (sponsor, admin, owner only) - MUST be before /:gameId route
    // GET /api/games/manage - List games for management (filtered by role)
    this.router.get('/manage', authenticate, requireRole(['sponsor', 'admin', 'owner']), this.getManageGames.bind(this));
    
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
    
    // GET /api/games/:gameId/manage/players - Get players for a game (for management)
    this.router.get('/:gameId/manage/players', authenticate, requireRole(['sponsor', 'admin', 'owner']), this.getManageGamePlayers.bind(this));
    
    // PUT /api/games/:gameId/status - Update game status
    this.router.put('/:gameId/status', authenticate, requireRole(['sponsor', 'admin', 'owner']), this.updateGameStatus.bind(this));
    
    // POST /api/games/:gameId/players/:playerId/end-turn - End a player's turn
    this.router.post('/:gameId/players/:playerId/end-turn', authenticate, requireRole(['sponsor', 'admin', 'owner']), this.endPlayerTurn.bind(this));
    
    // PUT /api/games/:gameId/players/:playerId/status - Update player status
    this.router.put('/:gameId/players/:playerId/status', authenticate, requireRole(['sponsor', 'admin', 'owner']), this.updatePlayerStatus.bind(this));
    
    // PUT /api/games/:gameId/players/:playerId/meta - Update player meta
    this.router.put('/:gameId/players/:playerId/meta', authenticate, requireRole(['sponsor', 'admin', 'owner']), this.updatePlayerMeta.bind(this));
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
      const { seed, mapSize, densityMin, densityMax, title, description, maxPlayers, status, params } = req.body;
      
      // Use authenticated user ID as owner
      const ownerId = req.user.id;
      
      // Debug logging
      console.log('Received request body:', req.body);
      console.log('Extracted values:', { seed, mapSize, densityMin, densityMax, title, description, maxPlayers, status, ownerId, params });
      
      // Validate required parameters
      if (!seed || !mapSize || densityMin === undefined || densityMax === undefined || !title || !description || !status || !ownerId)
      {
        return res.status(400).json({
          error: 'Missing required parameters: seed, mapSize, densityMin, densityMax, title, description, status, ownerId'
        });
      }
      
      // Validate maxPlayers if provided
      if (maxPlayers !== undefined) {
        if (maxPlayers < 1 || maxPlayers > mapSize * 2) {
          return res.status(400).json({
            error: `maxPlayers must be between 1 and ${mapSize * 2} (mapSize * 2)`
          });
        }
      }
      
      const result = await createEmptyGame({
        ownerId,
        seed,
        mapSize,
        densityMin,
        densityMax,
        title,
        description,
        maxPlayers,
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
      const { name, colorHex, countryName } = req.body;
      
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

      // Validate country name (required and must be unique per game)
      if (!countryName || !countryName.trim()) {
        return res.status(400).json({
          error: 'Country name is required'
        });
      }

      const trimmedCountryName = countryName.trim();
      const { rows: existingCountry } = await pool.query(
        `SELECT id FROM game_player WHERE game_id = $1 AND country_name = $2`,
        [gameId, trimmedCountryName]
      );

      if (existingCountry.length > 0) {
        return res.status(400).json({
          error: 'Country name is already taken in this game'
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
          countryName: trimmedCountryName,
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
        countryName: countryName ? countryName.trim() : null,
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

  /**
   * GET /api/games/manage
   * List games for management (filtered by role)
   * - sponsor: only games they created
   * - admin/owner: all games
   */
  async getManageGames(req, res)
  {
    try
    {
      const userId = req.user.id;
      const userRole = req.user.role;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      let query;
      let queryParams;

      if (userRole === 'sponsor') {
        // Sponsors only see their own games
        query = `
          SELECT 
            g.*,
            u.display_name as owner_display_name,
            COALESCE(gt.number, 0) as current_turn_number,
            COUNT(gp.id) as player_count
          FROM game g
          LEFT JOIN app_user u ON g.owner_id = u.id
          LEFT JOIN LATERAL (
            SELECT number 
            FROM game_turn 
            WHERE game_id = g.id 
            ORDER BY number DESC 
            LIMIT 1
          ) gt ON true
          LEFT JOIN game_player gp ON g.id = gp.game_id
          WHERE g.owner_id = $1
          GROUP BY g.id, u.display_name, gt.number
          ORDER BY g.created_at DESC
          LIMIT $2 OFFSET $3
        `;
        queryParams = [userId, limit, offset];
      } else {
        // Admin/owner see all games
        query = `
          SELECT 
            g.*,
            u.display_name as owner_display_name,
            COALESCE(gt.number, 0) as current_turn_number,
            COUNT(gp.id) as player_count
          FROM game g
          LEFT JOIN app_user u ON g.owner_id = u.id
          LEFT JOIN LATERAL (
            SELECT number 
            FROM game_turn 
            WHERE game_id = g.id 
            ORDER BY number DESC 
            LIMIT 1
          ) gt ON true
          LEFT JOIN game_player gp ON g.id = gp.game_id
          GROUP BY g.id, u.display_name, gt.number
          ORDER BY g.created_at DESC
          LIMIT $1 OFFSET $2
        `;
        queryParams = [limit, offset];
      }

      const { rows: games } = await pool.query(query, queryParams);

      // Get total count for pagination
      let countQuery;
      let countParams;
      if (userRole === 'sponsor') {
        countQuery = `SELECT COUNT(*) as total FROM game WHERE owner_id = $1`;
        countParams = [userId];
      } else {
        countQuery = `SELECT COUNT(*) as total FROM game`;
        countParams = [];
      }
      const { rows: countRows } = await pool.query(countQuery, countParams);
      const total = parseInt(countRows[0].total);

      res.json({
        success: true,
        games,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    }
    catch (error)
    {
      console.error('Error getting manage games:', error);
      res.status(500).json({
        error: 'Failed to get manage games',
        details: error.message
      });
    }
  }

  /**
   * GET /api/games/:gameId/manage/players
   * Get all players for a game (for management)
   */
  async getManageGamePlayers(req, res)
  {
    try
    {
      const { gameId } = req.params;
      
      if (!gameId) {
        return res.status(400).json({
          error: 'Game ID is required'
        });
      }

      // Verify game exists and user has permission
      const { rows: gameRows } = await pool.query(
        `SELECT g.*, u.role as user_role
         FROM game g
         LEFT JOIN app_user u ON g.owner_id = u.id
         WHERE g.id = $1`,
        [gameId]
      );

      if (gameRows.length === 0) {
        return res.status(404).json({
          error: 'Game not found'
        });
      }

      const game = gameRows[0];
      const userRole = req.user.role;

      // Check permission: sponsor can only manage their own games
      if (userRole === 'sponsor' && game.owner_id !== req.user.id) {
        return res.status(403).json({
          error: 'You can only manage games you created'
        });
      }

      // Get all players for the game
      const players = await listPlayers(gameId);

      res.json({
        success: true,
        players
      });
    }
    catch (error)
    {
      console.error('Error getting manage game players:', error);
      res.status(500).json({
        error: 'Failed to get game players',
        details: error.message
      });
    }
  }

  /**
   * PUT /api/games/:gameId/status
   * Update game status
   */
  async updateGameStatus(req, res)
  {
    try
    {
      const { gameId } = req.params;
      const { status } = req.body;
      
      if (!gameId || !status) {
        return res.status(400).json({
          error: 'Game ID and status are required'
        });
      }

      // Validate status
      const validStatuses = ['lobby', 'running', 'paused', 'frozen', 'finished'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      // Verify game exists and user has permission
      const { rows: gameRows } = await pool.query(
        `SELECT * FROM game WHERE id = $1`,
        [gameId]
      );

      if (gameRows.length === 0) {
        return res.status(404).json({
          error: 'Game not found'
        });
      }

      const game = gameRows[0];
      const userRole = req.user.role;

      // Check permission: sponsor can only manage their own games
      if (userRole === 'sponsor' && game.owner_id !== req.user.id) {
        return res.status(403).json({
          error: 'You can only manage games you created'
        });
      }

      // Validate status transitions
      if (game.status === 'finished' && status !== 'finished') {
        return res.status(400).json({
          error: 'Cannot change status of a finished game'
        });
      }

      // Update status
      const { updateGameStatus } = await import('../repos/gamesRepo.js');
      const updatedGame = await updateGameStatus({ id: gameId, status });

      // Set started_at if transitioning to running
      if (status === 'running' && !game.started_at) {
        await pool.query(
          `UPDATE game SET started_at = now() WHERE id = $1`,
          [gameId]
        );
      }

      res.json({
        success: true,
        game: updatedGame
      });
    }
    catch (error)
    {
      console.error('Error updating game status:', error);
      res.status(500).json({
        error: 'Failed to update game status',
        details: error.message
      });
    }
  }

  /**
   * POST /api/games/:gameId/players/:playerId/end-turn
   * End a player's turn (admin/sponsor/owner action)
   */
  async endPlayerTurn(req, res)
  {
    try
    {
      const { gameId, playerId } = req.params;
      
      if (!gameId || !playerId) {
        return res.status(400).json({
          error: 'Game ID and player ID are required'
        });
      }

      // Verify game exists and user has permission
      const { rows: gameRows } = await pool.query(
        `SELECT * FROM game WHERE id = $1`,
        [gameId]
      );

      if (gameRows.length === 0) {
        return res.status(404).json({
          error: 'Game not found'
        });
      }

      const game = gameRows[0];
      const userRole = req.user.role;

      // Check permission: sponsor can only manage their own games
      if (userRole === 'sponsor' && game.owner_id !== req.user.id) {
        return res.status(403).json({
          error: 'You can only manage games you created'
        });
      }

      // Use TurnService to end the turn
      const { TurnService } = await import('../services/TurnService.js');
      const turnService = new TurnService();
      const result = await turnService.endPlayerTurn(gameId, playerId);

      res.json({
        success: true,
        ...result
      });
    }
    catch (error)
    {
      console.error('Error ending player turn:', error);
      res.status(500).json({
        error: 'Failed to end player turn',
        details: error.message
      });
    }
  }

  /**
   * PUT /api/games/:gameId/players/:playerId/status
   * Update player status
   */
  async updatePlayerStatus(req, res)
  {
    try
    {
      const { gameId, playerId } = req.params;
      const { status } = req.body;
      
      if (!gameId || !playerId || !status) {
        return res.status(400).json({
          error: 'Game ID, player ID, and status are required'
        });
      }

      // Validate status
      const validStatuses = ['active', 'waiting', 'suspended', 'ejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      // Verify game exists and user has permission
      const { rows: gameRows } = await pool.query(
        `SELECT * FROM game WHERE id = $1`,
        [gameId]
      );

      if (gameRows.length === 0) {
        return res.status(404).json({
          error: 'Game not found'
        });
      }

      const game = gameRows[0];
      const userRole = req.user.role;

      // Check permission: sponsor can only manage their own games
      if (userRole === 'sponsor' && game.owner_id !== req.user.id) {
        return res.status(403).json({
          error: 'You can only manage games you created'
        });
      }

      // Verify player exists
      const { rows: playerRows } = await pool.query(
        `SELECT * FROM game_player WHERE id = $1 AND game_id = $2`,
        [playerId, gameId]
      );

      if (playerRows.length === 0) {
        return res.status(404).json({
          error: 'Player not found in this game'
        });
      }

      const player = playerRows[0];

      // Validate status transitions
      if (player.status === 'ejected' && status !== 'ejected') {
        return res.status(400).json({
          error: 'Cannot change status of an ejected player'
        });
      }

      // Update status
      const { rows: updatedRows } = await pool.query(
        `UPDATE game_player 
         SET status = $1 
         WHERE id = $2 AND game_id = $3 
         RETURNING *`,
        [status, playerId, gameId]
      );

      res.json({
        success: true,
        player: updatedRows[0]
      });
    }
    catch (error)
    {
      console.error('Error updating player status:', error);
      res.status(500).json({
        error: 'Failed to update player status',
        details: error.message
      });
    }
  }

  /**
   * PUT /api/games/:gameId/players/:playerId/meta
   * Update player meta (must be valid JSON)
   */
  async updatePlayerMeta(req, res)
  {
    try
    {
      const { gameId, playerId } = req.params;
      const { meta } = req.body;
      
      if (!gameId || !playerId) {
        return res.status(400).json({
          error: 'Game ID and player ID are required'
        });
      }

      if (meta === undefined) {
        return res.status(400).json({
          error: 'Meta is required'
        });
      }

      // Validate meta is valid JSON (if it's a string, try to parse it)
      let metaData;
      if (typeof meta === 'string') {
        try {
          metaData = JSON.parse(meta);
        } catch (e) {
          return res.status(400).json({
            error: 'Meta must be valid JSON'
          });
        }
      } else if (typeof meta === 'object') {
        metaData = meta;
      } else {
        return res.status(400).json({
          error: 'Meta must be a valid JSON object or string'
        });
      }

      // Verify game exists and user has permission
      const { rows: gameRows } = await pool.query(
        `SELECT * FROM game WHERE id = $1`,
        [gameId]
      );

      if (gameRows.length === 0) {
        return res.status(404).json({
          error: 'Game not found'
        });
      }

      const game = gameRows[0];
      const userRole = req.user.role;

      // Check permission: sponsor can only manage their own games
      if (userRole === 'sponsor' && game.owner_id !== req.user.id) {
        return res.status(403).json({
          error: 'You can only manage games you created'
        });
      }

      // Verify player exists
      const { rows: playerRows } = await pool.query(
        `SELECT * FROM game_player WHERE id = $1 AND game_id = $2`,
        [playerId, gameId]
      );

      if (playerRows.length === 0) {
        return res.status(404).json({
          error: 'Player not found in this game'
        });
      }

      // Update meta
      const { rows: updatedRows } = await pool.query(
        `UPDATE game_player 
         SET meta = $1 
         WHERE id = $2 AND game_id = $3 
         RETURNING *`,
        [JSON.stringify(metaData), playerId, gameId]
      );

      res.json({
        success: true,
        player: updatedRows[0]
      });
    }
    catch (error)
    {
      console.error('Error updating player meta:', error);
      res.status(500).json({
        error: 'Failed to update player meta',
        details: error.message
      });
    }
  }

  getRouter()
  {
    return this.router;
  }
}
