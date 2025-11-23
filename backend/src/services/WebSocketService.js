/**
 * WebSocketService - Manages WebSocket connections and game state notifications
 * Tracks which clients are viewing which games and sends real-time updates
 */

export class WebSocketService {
  constructor() {
    // Map of socketId -> { userId, gameId, playerId }
    this.connections = new Map();
    this.io = null;
  }

  /**
   * Initialize the WebSocket service with Socket.IO server
   * @param {Object} io - Socket.IO server instance
   */
  initialize(io) {
    this.io = io;
    this.setupEventHandlers();
    console.log('🔌 WebSocketService: Initialized');
  }

  /**
   * Set up Socket.IO event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 WebSocketService: Client connected: ${socket.id}`);

      // Handle authentication
      socket.on('authenticate', async (data) => {
        try {
          const { token } = data;
          if (!token) {
            socket.emit('error', { message: 'Authentication token required' });
            return;
          }

          // Verify JWT token (import here to avoid circular dependencies)
          const { verifyAccessToken } = await import('../utils/jwt.js');
          const decoded = verifyAccessToken(token);

          if (!decoded) {
            socket.emit('error', { message: 'Invalid or expired token' });
            return;
          }

          // Store user info in socket data
          socket.data.userId = decoded.id;
          socket.data.authenticated = true;

          console.log(`🔌 WebSocketService: Client ${socket.id} authenticated as user ${decoded.id}`);
          socket.emit('authenticated', { success: true });
        } catch (error) {
          console.error('🔌 WebSocketService: Authentication error:', error);
          socket.emit('error', { message: 'Authentication failed' });
        }
      });

      // Handle game join - client is viewing a game
      socket.on('game:join', async (data) => {
        if (!socket.data.authenticated) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        try {
          const { gameId, playerId } = data;
          if (!gameId) {
            socket.emit('error', { message: 'gameId required' });
            return;
          }

          // Verify user is a player in this game
          const { pool } = await import('../db/pool.js');
          const { rows } = await pool.query(
            `SELECT id FROM game_player WHERE game_id = $1 AND user_id = $2 AND type = 'player'`,
            [gameId, socket.data.userId]
          );

          if (rows.length === 0) {
            socket.emit('error', { message: 'Not a player in this game' });
            return;
          }

          // Register connection
          this.connections.set(socket.id, {
            userId: socket.data.userId,
            gameId,
            playerId: playerId || rows[0].id
          });

          console.log(`🔌 WebSocketService: Client ${socket.id} joined game ${gameId} (player ${playerId || rows[0].id})`);
          socket.emit('game:joined', { success: true, gameId, playerId: playerId || rows[0].id });
        } catch (error) {
          console.error('🔌 WebSocketService: Error joining game:', error);
          socket.emit('error', { message: 'Failed to join game' });
        }
      });

      // Handle game leave - client is no longer viewing a game
      socket.on('game:leave', () => {
        if (this.connections.has(socket.id)) {
          const connection = this.connections.get(socket.id);
          console.log(`🔌 WebSocketService: Client ${socket.id} left game ${connection.gameId}`);
          this.connections.delete(socket.id);
        }
        socket.emit('game:left', { success: true });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        if (this.connections.has(socket.id)) {
          const connection = this.connections.get(socket.id);
          console.log(`🔌 WebSocketService: Client ${socket.id} disconnected from game ${connection.gameId}`);
          this.connections.delete(socket.id);
        } else {
          console.log(`🔌 WebSocketService: Client ${socket.id} disconnected`);
        }
      });
    });
  }

  /**
   * Notify all clients viewing a specific game about a turn completion
   * @param {string} gameId - Game ID
   * @param {Object} updateData - Update data to send
   */
  notifyGameUpdate(gameId, updateData) {
    if (!this.io) {
      console.warn('🔌 WebSocketService: Cannot notify - Socket.IO not initialized');
      return;
    }

    // Find all connections for this game
    const gameConnections = [];
    for (const [socketId, connection] of this.connections.entries()) {
      if (connection.gameId === gameId) {
        gameConnections.push(socketId);
      }
    }

    if (gameConnections.length === 0) {
      console.log(`🔌 WebSocketService: No active connections for game ${gameId}`);
      return;
    }

    console.log(`🔌 WebSocketService: Notifying ${gameConnections.length} client(s) about turn completion for game ${gameId}`);

    // Send update to all clients viewing this game
    gameConnections.forEach(socketId => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('game:turnComplete', {
          type: 'game:turnComplete',
          gameId,
          ...updateData
        });
      }
    });
  }

  /**
   * Get count of active connections for a game
   * @param {string} gameId - Game ID
   * @returns {number} Number of active connections
   */
  getActiveGameConnections(gameId) {
    let count = 0;
    for (const connection of this.connections.values()) {
      if (connection.gameId === gameId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get all active connections (for debugging)
   * @returns {Array} Array of connection info
   */
  getAllConnections() {
    return Array.from(this.connections.entries()).map(([socketId, connection]) => ({
      socketId,
      ...connection
    }));
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();

