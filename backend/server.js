import 'dotenv/config'; // Load .env file at startup
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
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
import { webSocketService } from './src/services/WebSocketService.js';
import { startGameOrchestrator } from './src/services/StartGameOrchestrator.js';
import { asyncLocalStorage } from './src/utils/AsyncContext.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use((req, res, next) =>
{
   const correlationId = randomUUID();

   let clientTxId = req.get('X-Client-Tx-Id');

   if(typeof clientTxId !== 'string' || clientTxId.length > 128 || !/^[A-Za-z0-9-]+$/.test(clientTxId))
      clientTxId = undefined;

   asyncLocalStorage.run({ correlationId, clientTxId }, () => 
      {
         res.set('X-Correlation-Id', correlationId);

         next();
      });
});

const port = process.env.PORT || 3000;

app.get('/api/health', async (_req, res) =>
{
   try
   {
      const r = await pool.query('select 1 as ok');

      res.json({ok: r.rows[0].ok === 1});
   }
   catch (e)
   {
      res.status(500).json({ok: false, error: String(e)});
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

startGameOrchestrator.start()
  .then(() => 
  {
     console.log('🎮 StartGameOrchestrator: The orchestrator has started successfully');
  })
  .catch(error => 
  {
     console.error('🎮 StartGameOrchestrator: The orchestrator failed to start:', error);
  });

// DEV-only routes (for backward compatibility during transition)
if (process.env.NODE_ENV !== 'production')
{
   const legacyDevRouter = express.Router();

   // Redirect old dev routes to new production routes
   legacyDevRouter.post('/start-game', async (req, res) => gameRouter.createGame(req, res));// Forward to production endpoint
   legacyDevRouter.get('/current', async (req, res) => gameRouter.getCurrentGame(req, res));// Forward to production endpoint
   legacyDevRouter.get('/games', async (req, res) => gameRouter.listGames(req, res));// Forward to production endpoint
   legacyDevRouter.get('/state', async (req, res) =>
   {
      const { gameId } = req.query;

      if (!gameId)
         return res.status(400).json({ error: 'gameId parameter is required' });

      req.params = { gameId };

      return gameRouter.getGameState(req, res); // Forward to production endpoint
   });

   app.use('/api/dev-legacy', legacyDevRouter);
   console.log('🔧 Legacy DEV routes enabled at /api/dev-legacy (forwarding to production routes)');
}

// HTTPS Configuration (development only)
const useHTTPS = process.env.USE_HTTPS === 'true' || (process.env.NODE_ENV === 'development' && process.env.USE_HTTPS !== 'false');

let server;

if (useHTTPS)
{
   // Path to certificates (in project root, one level up from backend/)
   const certPath = path.resolve(__dirname, '..');
   const keyFile = path.join(certPath, 'localhost+1-key.pem');
   const certFile = path.join(certPath, 'localhost+1.pem');

   // Check if certificate files exist
   if (fs.existsSync(keyFile) && fs.existsSync(certFile))
   {
      try
      {
         const options = {key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile)};

         server = https.createServer(options, app);
         server.listen(port, () =>
         {
            console.log(`🔒 HTTPS server listening on port ${port}`);
            console.log(`🌐 Access your API at: https://localhost:${port}`);
            console.log(`📝 Health check: https://localhost:${port}/api/health`);
         });
      }
      catch (error)
      {
         console.error('❌ Error setting up HTTPS:', error.message);
         console.log('⚠️  Falling back to HTTP...');
         server = http.createServer(app);
         server.listen(port, () =>
         {
            console.log(`🔓 HTTP server listening on port ${port} (HTTPS failed)`);
            console.log(`🌐 Access your API at: http://localhost:${port}`);
         });
      }
   }
   else
   {
      console.warn('⚠️  Certificate files not found. Expected:');
      console.warn(`   - ${keyFile}`);
      console.warn(`   - ${certFile}`);
      console.warn('⚠️  Falling back to HTTP...');
      console.warn('💡 To use HTTPS: run "mkcert localhost 127.0.0.1" in project root');
      server = http.createServer(app);
      server.listen(port, () =>
      {
         console.log(`🔓 HTTP server listening on port ${port}`);
         console.log(`🌐 Access your API at: http://localhost:${port}`);
      });
   }
}
else
{
   // Use HTTP (production or explicitly disabled)
   server = http.createServer(app);
   server.listen(port, () =>
   {
      const protocol = process.env.NODE_ENV === 'production' ? '🔒 HTTPS' : '🔓 HTTP';
      console.log(`${protocol} server listening on port ${port}`);
      console.log(`🌐 Access your API at: http${process.env.NODE_ENV === 'production' ? 's' : ''}://localhost:${port}`);
   });
}

// Initialize Socket.IO with CORS configuration
// Allow both HTTP and HTTPS for localhost in development
const allowedOrigins = process.env.FRONTEND_URL 
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:5173', 'https://localhost:5173', 'http://localhost:3000', 'https://localhost:3000'];

const io = new Server(server,
{
   cors:
   {
      origin: (origin, callback) =>
      {
         // Allow requests with no origin (like mobile apps or curl requests)
         if (!origin) 
          return callback(null, true);

         if (allowedOrigins.indexOf(origin) !== -1)
            callback(null, true);
         else
            callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      credentials: true
   }
});

// Initialize WebSocket service
webSocketService.initialize(io);
console.log('🔌 WebSocket service initialized');
