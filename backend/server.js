import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { pool } from './src/db/pool.js';
import { GameRouter } from './src/routes/GameRouter.js';
import { OrdersRouter } from './src/routes/OrdersRouter.js';
import { TurnRouter } from './src/routes/TurnRouter.js';
import { DevRouter } from './src/routes/DevRouter.js';
import turnEventRouter from './src/routes/TurnEventRouter.js';

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

// Production routes
const gameRouter = new GameRouter();
const ordersRouter = new OrdersRouter();
const turnRouter = new TurnRouter();
const devRouter = new DevRouter();
app.use('/api/games', gameRouter.getRouter());
app.use('/api/orders', ordersRouter.getRouter());
app.use('/api/turns', turnRouter.getRouter());
app.use('/api/turn-events', turnEventRouter);
app.use('/api/dev', devRouter.router);

// DEV-only routes (for backward compatibility during transition)
if (process.env.NODE_ENV !== 'production') {
  const legacyDevRouter = express.Router();
  
  // Redirect old dev routes to new production routes
  legacyDevRouter.post('/start-game', async (req, res) => {
    // Forward to production endpoint
    return gameRouter.createGame(req, res);
  });
  
  legacyDevRouter.get('/current', async (req, res) => {
    // Forward to production endpoint
    return gameRouter.getCurrentGame(req, res);
  });
  
  legacyDevRouter.get('/state', async (req, res) => {
    // Forward to production endpoint
    const { gameId } = req.query;
    if (!gameId) {
      return res.status(400).json({ error: 'gameId parameter is required' });
    }
    req.params = { gameId };
    return gameRouter.getGameState(req, res);
  });
  
  legacyDevRouter.get('/games', async (req, res) => {
    // Forward to production endpoint
    return gameRouter.listGames(req, res);
  });
  
  app.use('/api/dev-legacy', legacyDevRouter);
  console.log('🔧 Legacy DEV routes enabled at /api/dev-legacy (forwarding to production routes)');
}

app.listen(port, () => {
  console.log(`API listening on ${port}`);
});
