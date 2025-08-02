const express = require('express');
const morgan = require('morgan');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware using Winston
app.use(morgan('combined', { stream: logger.stream }));

// Sample game state data
const sampleGameState = {
  gameId: "game_12345",
  status: "active",
  players: [
    {
      id: "player_1",
      name: "Player One",
      health: 100,
      position: { x: 10, y: 20 },
      inventory: ["sword", "shield", "potion"]
    },
    {
      id: "player_2", 
      name: "Player Two",
      health: 85,
      position: { x: 15, y: 25 },
      inventory: ["bow", "arrows", "healing_potion"]
    }
  ],
  world: {
    map: "forest_realm",
    time: "day",
    weather: "clear"
  },
  events: [
    {
      id: "event_1",
      type: "combat",
      description: "Player One defeated a goblin",
      timestamp: new Date().toISOString()
    }
  ],
  lastUpdated: new Date().toISOString()
};

// Routes
app.get('/', (req, res) => {
  logger.info('Root endpoint accessed');
  res.json({ 
    message: 'LoH Backend Server', 
    version: '1.0.0',
    endpoints: {
      game: '/api/game'
    }
  });
});

app.get('/api/game', (req, res) => {
  logger.info('Game state requested', { 
    method: req.method, 
    path: req.path,
    userAgent: req.get('User-Agent')
  });
  
  res.json({
    success: true,
    data: sampleGameState
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error', { 
    error: err.message, 
    stack: err.stack,
    method: req.method,
    path: req.path
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn('Route not found', { 
    method: req.method, 
    path: req.originalUrl 
  });
  
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server started successfully`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = app; 