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
import { ApiRequest, ApiEvent } from '../events/Events.js';
import { EventRegister } from '../EventRegister.js';
import { RB } from '../utils/RequestBuilder.js';

export class SessionController
{
   constructor()
   {
      this.eventRegister = new EventRegister();

      this.eventRegister.registerEventHandler('system:loginRequest', this.handleLoginRequest.bind(this));
      this.eventRegister.registerEventHandler('system:logoutRequest', this.handleLogoutRequest.bind(this));

      this._handleWebSocketConnected = this.handleWebSocketConnected.bind(this);
      webSocketManager.addConnectionListener(this._handleWebSocketConnected);
   }

   /**
    * Handle user login event
    * @param {Object} event - User data from login
    */
   handleLoginRequest(event)
   {
      console.log('🔐 SessionController: Processing login for user:', event);

      if (!(event instanceof ApiRequest))
         throw new Error('SessionController: Invalid event type');

      let response = null;

      // Attempt login via API - move this to SystemEventHandler
      RB.fetchPostUnauthenticated('/api/auth/login', {...event.data}, event.signal)
         .then(success =>
         {
            console.log('Login success:', success);

            response = event.prepareResponse('system:loginSuccess', {email: event.data.email}, 200, null);

            tokenStore.setTokens({ accessToken: success.accessToken, refreshToken: success.refreshToken, expiresAt: success.expiresAt });
            webSocketManager.connect(); // WebSocketManager will connect, and when it does, we'll authenticate
            
            if (success.user) // Store user info (user_id is not stored - backend extracts it from JWT token)
            {
               localStorage.setItem('user_email', success.user.email);
               localStorage.setItem('user_display_name', success.user.displayName);
               localStorage.setItem('user_role', success.user.role || 'visitor');
               localStorage.setItem('user_email_verified', success.user.emailVerified?.toString() || 'false');
            }
         })
         .catch(error =>
         {
            console.error('Login error:', error);

            response = event.prepareResponse('system:loginFailure', {email: event.data.email}, 401, error.body);
         })
         .finally(() =>
         {
            console.log('Login finally', response);

            setTimeout(() =>
            {
               eventBus.emit(response.type, response);
            }, 1000); // simulate network delay

            // eventBus.emit(response.type, response);
         });
   }

   /**
    * Handle logout request - clear tokens and disconnect WebSocket
    * @param {Object} event - Logout request event
    */
   handleLogoutRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing logout for user:', event);

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      const refreshToken = tokenStore.getRefreshToken();

      if (refreshToken)
         RB.fetchPost('/api/auth/logout', {refreshToken}, event.signal)
            .then(success =>
            {
               console.log('Logout success:', success);
               eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Logout successful!', type: 'success'}));
            })
            .catch(error =>
            {
               console.error('Logout error:', error);
               eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Logout failed!', type: 'error'}));
            })
            .finally(() =>
            {
               localStorage.clear();
               tokenStore.clear();
               webSocketManager.disconnect();
               eventBus.emit('ui:showScreen', new ApiEvent('ui:showScreen', {targetScreen: 'splash'}));
            });
   }

   /**
    * Handle WebSocket connected event - send authentication message
    * This is called when WebSocketManager notifies that connection is established
    */
   handleWebSocketConnected()
   {
      // Get token from TokenStore
      const token = tokenStore.getAccessToken();
      if (!token)
      {
         console.warn('🔐 SessionController: No token available for WebSocket authentication');
         return;
      }

      // Send authentication message to WebSocket
      // This is the ONLY place that sends the authenticate message
      webSocketManager.send('authenticate', { token });
   }

   /**
    * Dispose the controller - remove event listeners
    */
   dispose()
   {
      this.eventRegister.unregisterEventHandlers();
      webSocketManager.removeConnectionListener(this._handleWebSocketConnected);
   }
}
