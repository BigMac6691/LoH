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
 * - Decode incoming messages and forward to the event bus
 * - Notify connection state listeners of connection changes
 * - Provide send() method for outgoing messages
 * 
 * What it does NOT do:
 * - Know what authentication is (SessionController handles that)
 * - Automatically emit authentication messages (SessionController does that)
 * - Know about game lifecycle or gameId validity
 * - Manage game session lifecycle
 * - Talk to UI components
 * 
 * SessionController registers as a connection listener and handles authentication.
 */
import io from 'socket.io-client';
import { eventBus } from '../eventBus.js';
import { ApiEvent, ApiResponse } from '../events/Events.js';

export class WebSocketManager
{
   constructor()
   {
      this.socket = null;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 1000; // Start with 1 second

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

   subscribe(type, entityIds = [])
   {
      this.send('subscribe', { type, entityIds });
   }

   unsubscribe(type)
   {
      this.send('unsubscribe', { type });
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

         const payload = data?.data ?? data;
         const handler = wsEventHandlers[event];

         if (handler)
            handler(payload);
         else
            console.debug('🔌 WebSocketManager: No handler found for event:', event);
      });

      // Connection established
      this.socket.on('connect', () =>
      {
         this.reconnectAttempts = 0;
         this.reconnectDelay = 1000;

         // Notify connection listeners
         this.notifyConnectionListeners('connected');
         eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Connected to server for turn updates', type: 'success'}));
      });

      // Disconnected
      this.socket.on('disconnect', (reason) =>
      {
         this.notifyConnectionListeners('disconnected', reason);

         // If it was an unexpected disconnect, attempt reconnection
         if (reason === 'io server disconnect') // Server disconnected, reconnect manually
            this.socket.connect();

         eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Disconnected from server for turn updates', type: 'warning'}));
      });

      // Reconnection attempt
      this.socket.on('reconnect_attempt', (attemptNumber) =>
      {
         this.reconnectAttempts = attemptNumber;

         this.notifyConnectionListeners('reconnecting', attemptNumber);
         eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: `Reconnecting to server for turn updates (attempt ${attemptNumber})`, type: 'warning'}));
      });

      // Reconnection failed
      this.socket.on('reconnect_failed', () =>
      {
         this.notifyConnectionListeners('connectionFailed');
         eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Failed to reconnect to server for turn updates', type: 'error'}));
      });
   }

   addMessageListener()
   {
      console.warn('🔌 WebSocketManager: Message listeners are deprecated; use eventBus instead');
   }

   removeMessageListener()
   {
      console.warn('🔌 WebSocketManager: Message listeners are deprecated; use eventBus instead');
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
    * Disconnect from WebSocket server, happens after logout
    */
   disconnect()
   {
      if (this.socket)
      {
         this.socket.disconnect();
         this.socket = null;

         console.log('🔌 WebSocketManager: Disconnected');
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

const wsEventHandlers = 
{
   subscribed: (data) =>
   {
      eventBus.emitEvent(new ApiEvent('ui:statusMessage', {message: `Subscribed to event type ${data.type}`, type: 'success'}));
   },
   unsubscribed: (data) =>
   {
      eventBus.emitEvent(new ApiEvent('ui:statusMessage', {message: `Unsubscribed from event type ${data.type}`, type: 'success'}));
   },
   "system:gameUpdated": (data) =>
   {
      eventBus.emitEvent(new ApiResponse('system:gameUpdated', data));
   }
};