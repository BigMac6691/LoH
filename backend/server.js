import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { pool } from './src/db/pool.js';
import { startGameFromSeed } from './src/services/startGameService.js';
import { getGame, listGames } from './src/repos/gamesRepo.js';
import { getOpenTurn } from './src/repos/turnsRepo.js';
import { listPlayers } from './src/repos/playersRepo.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const port = process.env.PORT || 3000;

app.get('/api/health', async (_req, res) => {
  try {
    const r = await pool.query('select 1 as ok');
    res.json({ ok: r.rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// DEV-only routes - TODO: Remove in production
if (process.env.NODE_ENV !== 'production') {
  const devRouter = express.Router();
  
  /**
   * POST /api/dev/start-game
   * Start a new game from seed with provided configuration
   */
  devRouter.post('/start-game', async (req, res) => {
    try {
      const { seed, mapSize, densityMin, densityMax, title, description, players } = req.body;
      
      // Debug logging
      console.log('Received request body:', req.body);
      console.log('Extracted values:', { seed, mapSize, densityMin, densityMax, title, description, players });
      
      // Validate required parameters
      if (!seed || !mapSize || densityMin === undefined || densityMax === undefined || !title || !description || !players) {
        return res.status(400).json({
          error: 'Missing required parameters: seed, mapSize, densityMin, densityMax, title, description, players'
        });
      }
      
      // TODO: Add proper owner ID handling
      const ownerId = "a109d369-0df3-4e73-b262-62c793ad743f";//randomUUID(); // Generate a proper UUID for development
      
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
      
    } catch (error) {
      console.error('Error starting game:', error);
      res.status(500).json({
        error: 'Failed to start game',
        details: error.message
      });
    }
  });
  
  /**
   * GET /api/dev/current
   * Get the latest game with open turn and players
   */
  devRouter.get('/current', async (req, res) => {
    try {
      // TODO: Add proper game selection logic
      // For now, get the most recently created game
      const { rows: games } = await pool.query(
        `SELECT * FROM game ORDER BY created_at DESC LIMIT 1`
      );
      
      if (games.length === 0) {
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
      
    } catch (error) {
      console.error('Error getting current game:', error);
      res.status(500).json({
        error: 'Failed to get current game',
        details: error.message
      });
    }
  });
  
  /**
   * GET /api/dev/state?gameId=...
   * Get complete game state including stars, wormholes, star states, and ships
   */
  devRouter.get('/state', async (req, res) => {
    try {
      const { gameId } = req.query;
      
      if (!gameId) {
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
      
      res.json({
        stars,
        wormholes,
        starStates,
        ships,
        players,
        counts: {
          stars: stars.length,
          wormholes: wormholes.length,
          starStates: starStates.length,
          ships: ships.length
        }
      });
      
    } catch (error) {
      console.error('Error getting game state:', error);
      res.status(500).json({
        error: 'Failed to get game state',
        details: error.message
      });
    }
  });
  
  /**
   * GET /api/dev/games
   * Get all games for the dropdown list
   */
  devRouter.get('/games', async (req, res) => {
    try {
      const games = await listGames();
      res.json(games);
    } catch (error) {
      console.error('Error getting games list:', error);
      res.status(500).json({
        error: 'Failed to get games list',
        details: error.message
      });
    }
  });
  
  // Mount the dev router
  app.use('/api/dev', devRouter);
  
  console.log('🔧 DEV routes enabled at /api/dev');
}

app.listen(port, () => {
  console.log(`API listening on ${port}`);
});
