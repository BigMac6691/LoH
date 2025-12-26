/**
 * WebSocketManager - Transport-only service for WebSocket communication
 * 
 * Why WebSocketManager is transport-only:
 * - Separates transport concerns (connection, messages) from business logic (auth, game state)
 * - Allows SessionController to coordinate authentication without WebSocketManager knowing about it
 * - Allows GameSession to validate messages without WebSocketManager knowing about game lifecycle
 * 
 * Responsibilities:
 * - Maintain WebSocket connection (connect, disconnect, reconnect)
 * - Decode incoming messages and forward to message listeners
 * - Notify connection state listeners of connection changes
 * - Provide send() method for outgoing messages
 * 
 * What it does NOT do:
 * - Know what authentication is (SessionController handles that)
 * - Automatically emit authentication messages (SessionController does that)
 * - Emit game events on eventBus (message listeners handle that)
 * - Know about game lifecycle or gameId validity
 * - Manage game session lifecycle
 * - Talk to UI components
 * 
 * GameSession registers as a message listener and decides whether messages are valid.
 * SessionController registers as a connection listener and handles authentication.
 */
import io from 'socket.io-client';
import { eventBus } from '../eventBus.js';

export class WebSocketManager
{
   constructor()
   {
      this.socket = null;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 1000; // Start with 1 second

      /**
       * Registered message listeners for game-related WebSocket messages
       * Listeners receive decoded messages with event type and data
       * Usually only one active listener (GameSession), but supports multiple
       */
      this.messageListeners = new Set();

      /**
       * Registered connection state listeners
       * Listeners are notified when connection state changes (connected, disconnected, etc.)
       * Usually only one active listener (SessionController), but supports multiple
       */
      this.connectionListeners = new Set();
   }

   /**
    * Connect to WebSocket server
    * Transport-only: does not check for tokens or handle authentication
    * SessionController coordinates authentication after connection
    */
   connect()
   {
      if (this.socket && this.socket?.connected)
      {
         console.log('🔌 WebSocketManager: Already connected');
         return;
      }

      // Determine WebSocket URL
      // In development, Vite proxies /api to backend, so we connect to the same origin
      // Socket.IO will use the same host/port as the frontend, and Vite will proxy it
      // In production, this will connect directly to the backend if on same host
      const wsUrl = window.location.origin;

      console.log('🔌 WebSocketManager: Connecting to', wsUrl);

      this.socket = io(wsUrl,
      {
         transports: ['websocket', 'polling'],
         reconnection: true,
         reconnectionDelay: this.reconnectDelay,
         reconnectionAttempts: this.maxReconnectAttempts,
         path: '/socket.io/' // Socket.IO default path
      });

      this.setupEventHandlers();
   }

   send(event, data)
   {
      if (this.socket && this.socket?.connected)
         this.socket.emit(event, data);
      else
         console.warn('🔌 WebSocketManager: Not connected, cannot send message');
   }

   /**
    * Set up Socket.IO event handlers
    */
   setupEventHandlers()
   {
      if (!this.socket) 
         return;

      this.socket.onAny((event, data) =>
      {
         console.log('🔌 WebSocketManager: Received event:', event, data);
         this.notifyListeners(event, data);
      });

      // Connection established
      this.socket.on('connect', () =>
      {
         console.log('🔌 WebSocketManager: Connected to server');
         this.reconnectAttempts = 0;
         this.reconnectDelay = 1000;

         // Notify connection listeners
         this.notifyConnectionListeners('connected');
      });

      // Disconnected
      this.socket.on('disconnect', (reason) =>
      {
         console.log('🔌 WebSocketManager: Disconnected:', reason);

         // Notify connection listeners
         this.notifyConnectionListeners('disconnected', reason);

         // If it was an unexpected disconnect, attempt reconnection
         if (reason === 'io server disconnect') // Server disconnected, reconnect manually
            this.socket.connect();
      });

      // Reconnection attempt
      this.socket.on('reconnect_attempt', (attemptNumber) =>
      {
         console.log(`🔌 WebSocketManager: Reconnection attempt ${attemptNumber}`);
         this.reconnectAttempts = attemptNumber;

         // Notify connection listeners
         this.notifyConnectionListeners('reconnecting', attemptNumber);
      });

      // Reconnection failed
      this.socket.on('reconnect_failed', () =>
      {
         console.error('🔌 WebSocketManager: Reconnection failed after maximum attempts');

         // Notify connection listeners
         this.notifyConnectionListeners('connectionFailed');
      });
   }

   /**
    * Register a listener to receive game-related WebSocket messages
    * @param {Function} listener - Function that receives (eventType, data) for game messages
    */
   addMessageListener(listener)
   {
      if (typeof listener !== 'function')
         throw new Error('WebSocketManager: Listener must be a function');

      this.messageListeners.add(listener);
      console.log(`🔌 WebSocketManager: Added message listener (${this.messageListeners.size} total)`);
   }

   /**
    * Remove a registered message listener
    * @param {Function} listener - The listener function to remove
    */
   removeMessageListener(listener)
   {
      if (this.messageListeners.delete(listener))
         console.log(`🔌 WebSocketManager: Removed message listener (${this.messageListeners.size} remaining)`);
   }

   /**
    * Register a listener for connection state changes
    * @param {Function} listener - Function that receives (state, data) where state is 'connected', 'disconnected', 'reconnecting', or 'connectionFailed'
    */
   addConnectionListener(listener)
   {
      if (typeof listener !== 'function')
         throw new Error('WebSocketManager: Connection listener must be a function');

      this.connectionListeners.add(listener);
      console.log(`🔌 WebSocketManager: Added connection listener (${this.connectionListeners.size} total)`);
   }

   /**
    * Remove a registered connection listener
    * @param {Function} listener - The listener function to remove
    */
   removeConnectionListener(listener)
   {
      if (this.connectionListeners.delete(listener))
         console.log(`🔌 WebSocketManager: Removed connection listener (${this.connectionListeners.size} remaining)`);
   }

   /**
    * Notify all registered connection listeners of state changes
    * @param {string} state - Connection state: 'connected', 'disconnected', 'reconnecting', 'connectionFailed'
    * @param {*} data - Optional data (e.g., disconnect reason, attempt number)
    * @private
    */
   notifyConnectionListeners(state, data = null)
   {
      // Emit on eventBus for backward compatibility and for SessionController
      // This allows SessionController to listen via eventBus without direct coupling
      eventBus.emit(`websocket:${state}`, data);

      // Also notify direct listeners
      this.connectionListeners.forEach(listener =>
      {
         try
         {
            listener(state, data);
         }
         catch (error)
         {
            console.error(`🔌 WebSocketManager: Error in connection listener for ${state}:`, error);
         }
      });
   }

   /**
    * Notify all registered listeners of a game-related message
    * @param {string} eventType - The event type (e.g., 'game:turnComplete')
    * @param {Object} data - The message data
    * @private
    */
   notifyListeners(eventType, data)
   {
      if (this.messageListeners.size === 0)
      {
         console.log(`🔌 WebSocketManager: No listeners registered for ${eventType}, message dropped`);
         return;
      }

      // Forward message to all registered listeners
      // Listeners are responsible for session validation and further routing
      this.messageListeners.forEach(listener =>
      {
         try
         {
            listener(eventType, data);
         }
         catch (error)
         {
            console.error(`🔌 WebSocketManager: Error in message listener for ${eventType}:`, error);
         }
      });
   }

   /**
    * Disconnect from WebSocket server, happens after logout
    * Clears all message listeners to prevent memory leaks
    */
   disconnect()
   {
      if (this.socket)
      {
         this.socket.disconnect();
         this.socket = null;
         this.socket?.connected = false;
         
         // Clear all listeners to prevent memory leaks
         this.messageListeners.clear();
         
         console.log('🔌 WebSocketManager: Disconnected and cleared listeners');
      }
   }

   /**
    * Check if WebSocket is connected
    * @returns {boolean} True if connected
    */
   isWebSocketConnected()
   {
      return this.socket?.connected ?? false;
   }
}

// Export singleton instance
export const webSocketManager = new WebSocketManager();
