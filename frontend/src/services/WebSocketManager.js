/**
 * WebSocketManager - Manages WebSocket connection for real-time game updates
 * Handles connection, authentication, and game registration
 */

import { io } from 'socket.io-client';
import { eventBus } from '../eventBus.js';

export class WebSocketManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentGameId = null;
    this.currentPlayerId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.socket && this.isConnected) {
      console.log('🔌 WebSocketManager: Already connected');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      console.warn('🔌 WebSocketManager: No access token found, cannot connect');
      return;
    }

    // Determine WebSocket URL
    // In development, Vite proxies /api to backend, so we connect to the same origin
    // Socket.IO will use the same host/port as the frontend, and Vite will proxy it
    // In production, this will connect directly to the backend if on same host
    const wsUrl = window.location.origin;

    console.log('🔌 WebSocketManager: Connecting to', wsUrl);

    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
      path: '/socket.io/' // Socket.IO default path
    });

    this.setupEventHandlers();
  }

  /**
   * Set up Socket.IO event handlers
   */
  setupEventHandlers() {
    if (!this.socket) return;

    // Connection established
    this.socket.on('connect', () => {
      console.log('🔌 WebSocketManager: Connected to server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;

      // Authenticate with token
      const token = localStorage.getItem('access_token');
      if (token) {
        this.socket.emit('authenticate', { token });
      }
    });

    // Authentication successful
    this.socket.on('authenticated', (data) => {
      console.log('🔌 WebSocketManager: Authentication successful');
      
      // Re-join current game if we were viewing one
      if (this.currentGameId && this.currentPlayerId) {
        this.joinGame(this.currentGameId, this.currentPlayerId);
      }
    });

    // Authentication failed
    this.socket.on('error', (error) => {
      console.error('🔌 WebSocketManager: Error:', error);
    });

    // Game joined successfully
    this.socket.on('game:joined', (data) => {
      console.log('🔌 WebSocketManager: Successfully joined game:', data.gameId);
    });

    // Game left successfully
    this.socket.on('game:left', (data) => {
      console.log('🔌 WebSocketManager: Left game');
    });

    // Turn completion notification
    this.socket.on('game:turnComplete', (data) => {
      console.log('🔌 WebSocketManager: Received turn completion notification:', data);
      
      // Verify this update is for the game we're currently viewing
      const context = eventBus.getContext();
      if (context.gameId === data.gameId) {
        console.log('🔌 WebSocketManager: Turn completion matches current game, refreshing...');
        // Emit event to refresh game state
        eventBus.emit('game:startGame', { gameId: data.gameId });
      } else {
        console.log('🔌 WebSocketManager: Turn completion is for different game, ignoring');
      }
    });

    // Disconnected
    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocketManager: Disconnected:', reason);
      this.isConnected = false;
      
      // If it was an unexpected disconnect, attempt reconnection
      if (reason === 'io server disconnect') {
        // Server disconnected, reconnect manually
        this.socket.connect();
      }
    });

    // Reconnection attempt
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔌 WebSocketManager: Reconnection attempt ${attemptNumber}`);
      this.reconnectAttempts = attemptNumber;
    });

    // Reconnection failed
    this.socket.on('reconnect_failed', () => {
      console.error('🔌 WebSocketManager: Reconnection failed after maximum attempts');
      // Emit event to fall back to polling
      eventBus.emit('websocket:connectionFailed', {});
    });
  }

  /**
   * Join a game (register that we're viewing this game)
   * @param {string} gameId - Game ID
   * @param {string} playerId - Player ID
   */
  joinGame(gameId, playerId) {
    if (!this.socket || !this.isConnected) {
      console.warn('🔌 WebSocketManager: Cannot join game - not connected');
      return;
    }

    this.currentGameId = gameId;
    this.currentPlayerId = playerId;

    console.log(`🔌 WebSocketManager: Joining game ${gameId} as player ${playerId}`);
    this.socket.emit('game:join', { gameId, playerId });
  }

  /**
   * Leave the current game
   */
  leaveGame() {
    if (!this.socket || !this.isConnected) {
      return;
    }

    if (this.currentGameId) {
      console.log(`🔌 WebSocketManager: Leaving game ${this.currentGameId}`);
      this.socket.emit('game:leave');
      this.currentGameId = null;
      this.currentPlayerId = null;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.leaveGame();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('🔌 WebSocketManager: Disconnected');
    }
  }

  /**
   * Check if WebSocket is connected
   * @returns {boolean} True if connected
   */
  isWebSocketConnected() {
    return this.isConnected && this.socket && this.socket.connected;
  }
}

// Export singleton instance
export const webSocketManager = new WebSocketManager();

