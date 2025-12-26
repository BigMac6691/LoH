/**
 * SessionController - Manages user authentication lifecycle
 * 
 * Why SessionController exists:
 * - Centralizes authentication coordination between TokenStore and WebSocketManager
 * - Owns the authentication lifecycle (login/logout) without UI or game logic
 * - Ensures WebSocket authentication happens at the right time (after connection)
 * - Single responsibility: coordinate auth state between token storage and transport layer
 * 
 * Responsibilities:
 * - Listen to auth-related events (login success, logout)
 * - Store tokens in TokenStore on login
 * - Initiate WebSocket connection on login
 * - Clear tokens and disconnect WebSocket on logout
 * - Send authentication message when WebSocket connects
 * 
 * What it does NOT do:
 * - Handle UI logic (screens, messages)
 * - Handle game logic
 * - Know about game sessions
 * - Process login/logout requests (SystemEventHandler does that)
 */
import { eventBus } from '../eventBus.js';
import { tokenStore } from './TokenStore.js';
import { webSocketManager } from './WebSocketManager.js';
import { ApiResponse } from '../events/Events.js';

export class SessionController
{
   constructor()
   {
      /**
       * Track bound handlers for cleanup
       */
      this.boundHandlers = new Map();

      this.setupEventListeners();
   }

   /**
    * Set up event listeners for authentication lifecycle
    */
   setupEventListeners()
   {
      // Listen for login success
      this.boundHandlers.set('system:loginResponse', this.handleLoginResponse.bind(this));
      eventBus.on('system:loginResponse', this.boundHandlers.get('system:loginResponse'));

      // Listen for logout request
      this.boundHandlers.set('system:logoutRequest', this.handleLogoutRequest.bind(this));
      eventBus.on('system:logoutRequest', this.boundHandlers.get('system:logoutRequest'));

      // Listen for WebSocket connection state changes
      this.boundHandlers.set('websocket:connected', this.handleWebSocketConnected.bind(this));
      eventBus.on('websocket:connected', this.boundHandlers.get('websocket:connected'));
   }

   /**
    * Handle login response - store token and initiate WebSocket connection
    * @param {ApiResponse} event - Login response event
    */
   handleLoginResponse(event)
   {
      // Only process successful logins
      if (!(event instanceof ApiResponse) || !event.isSuccess())
         return;

      // Extract token from localStorage (SystemEventHandler stores it there)
      // We read from localStorage here because SystemEventHandler hasn't been refactored yet
      // In the future, SystemEventHandler could emit the token in the event
      const token = localStorage.getItem('access_token');
      if (!token)
      {
         console.warn('🔐 SessionController: No access token found after login');
         return;
      }

      // Store token in TokenStore
      tokenStore.setToken(token);

      // Initiate WebSocket connection
      // WebSocketManager will connect, and when it does, we'll authenticate
      webSocketManager.connect();
   }

   /**
    * Handle logout request - clear token and disconnect WebSocket
    * @param {Object} event - Logout request event
    */
   handleLogoutRequest(event)
   {
      // Clear token from TokenStore
      tokenStore.clearToken();

      // Disconnect WebSocket
      webSocketManager.disconnect();
   }

   /**
    * Handle WebSocket connected event - send authentication message
    * This is called when WebSocketManager notifies that connection is established
    */
   handleWebSocketConnected()
   {
      // Get token from TokenStore
      const token = tokenStore.getToken();
      if (!token)
      {
         console.warn('🔐 SessionController: No token available for WebSocket authentication');
         return;
      }

      // Send authentication message to WebSocket
      // This is the ONLY place that sends the authenticate message
      webSocketManager.send('authenticate', {token});
   }

   /**
    * Dispose the controller - remove event listeners
    */
   dispose()
   {
      for (const [eventType, handler] of this.boundHandlers)
      {
         eventBus.off(eventType, handler);
      }

      this.boundHandlers.clear();
   }
}

