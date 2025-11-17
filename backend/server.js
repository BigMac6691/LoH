import 'dotenv/config'; // Load .env file at startup
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { pool } from './src/db/pool.js';
import { GameRouter } from './src/routes/GameRouter.js';
import { OrdersRouter } from './src/routes/OrdersRouter.js';
import { TurnRouter } from './src/routes/TurnRouter.js';
import { DevRouter } from './src/routes/DevRouter.js';
import { AuthRouter } from './src/routes/AuthRouter.js';
import { AdminRouter } from './src/routes/AdminRouter.js';
import { SystemEventRouter } from './src/routes/SystemEventRouter.js';
import { AIRouter } from './src/routes/AIRouter.js';
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
const authRouter = new AuthRouter();
const adminRouter = new AdminRouter();
const systemEventRouter = new SystemEventRouter();
const aiRouter = new AIRouter();
app.use('/api/games', gameRouter.getRouter());
app.use('/api/orders', ordersRouter.getRouter());
app.use('/api/turns', turnRouter.getRouter());
app.use('/api/turn-events', turnEventRouter);
app.use('/api/auth', authRouter.getRouter());
app.use('/api/dev', devRouter.router);
app.use('/api/admin', adminRouter.getRouter());
app.use('/api/system-events', systemEventRouter.getRouter());
app.use('/api/ai', aiRouter.getRouter());

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

// HTTPS Configuration (development only)
const useHTTPS = process.env.USE_HTTPS === 'true' || (process.env.NODE_ENV === 'development' && process.env.USE_HTTPS !== 'false');

if (useHTTPS) {
  // Path to certificates (in project root, one level up from backend/)
  const certPath = path.resolve(__dirname, '..');
  const keyFile = path.join(certPath, 'localhost+1-key.pem');
  const certFile = path.join(certPath, 'localhost+1.pem');

  // Check if certificate files exist
  if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
    try {
      const options = {
        key: fs.readFileSync(keyFile),
        cert: fs.readFileSync(certFile)
      };

      https.createServer(options, app).listen(port, () => {
        console.log(`🔒 HTTPS server listening on port ${port}`);
        console.log(`🌐 Access your API at: https://localhost:${port}`);
        console.log(`📝 Health check: https://localhost:${port}/api/health`);
      });
    } catch (error) {
      console.error('❌ Error setting up HTTPS:', error.message);
      console.log('⚠️  Falling back to HTTP...');
      http.createServer(app).listen(port, () => {
        console.log(`🔓 HTTP server listening on port ${port} (HTTPS failed)`);
        console.log(`🌐 Access your API at: http://localhost:${port}`);
      });
    }
  } else {
    console.warn('⚠️  Certificate files not found. Expected:');
    console.warn(`   - ${keyFile}`);
    console.warn(`   - ${certFile}`);
    console.warn('⚠️  Falling back to HTTP...');
    console.warn('💡 To use HTTPS: run "mkcert localhost 127.0.0.1" in project root');
    http.createServer(app).listen(port, () => {
      console.log(`🔓 HTTP server listening on port ${port}`);
      console.log(`🌐 Access your API at: http://localhost:${port}`);
    });
  }
} else {
  // Use HTTP (production or explicitly disabled)
  http.createServer(app).listen(port, () => {
    const protocol = process.env.NODE_ENV === 'production' ? '🔒 HTTPS' : '🔓 HTTP';
    console.log(`${protocol} server listening on port ${port}`);
    console.log(`🌐 Access your API at: http${process.env.NODE_ENV === 'production' ? 's' : ''}://localhost:${port}`);
  });
}
