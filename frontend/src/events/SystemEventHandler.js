/**
 * System Event Handler - Manages system-level events and context
 * Handles user login, game selection, and other system-wide events
 */
import { eventBus }from '../eventBus.js';
import { ApiEvent, ApiRequest, ApiResponse } from './Events.js';
import { RB, ApiError } from '../utils/RequestBuilder.js';
import { webSocketManager } from '../services/WebSocketManager.js';

export class SystemEventHandler
{
   constructor()
   {
      this.userLoggedIn = false;

      eventBus.on('system:loginRequest', this.handleLoginRequest.bind(this));
      eventBus.on('system:loginResponse', this.handleLoginResponse.bind(this));
      eventBus.on('system:registerRequest', this.handleRegisterRequest.bind(this));
      eventBus.on('system:recoverRequest', this.handleRecoverRequest.bind(this));
      eventBus.on('system:resetPasswordRequest', this.handleResetPasswordRequest.bind(this));
      eventBus.on('system:allAssetsLoaded', this.handleAllAssetsLoaded.bind(this));
      eventBus.on('system:logoutRequest', this.handleLogoutRequest.bind(this));
   }

   /**
    * Handle all assets loaded event, if no user has logged in, emit system:systemReady event
    * @param {ApiResponse} event - Event object
    */
   handleAllAssetsLoaded(event)
   {
      console.log('🔐 SystemEventHandler: All assets loaded:', event, event.data);

      if (!this.userLoggedIn)
         eventBus.emit('system:systemReady', new ApiEvent('system:systemReady'));
   }

   /**
    * Handle login response to track login status
    * @param {ApiResponse} event - Login response event
    */
   handleLoginResponse(event)
   {
      if(!(event instanceof ApiResponse))
         throw new Error('SystemEventHandler: Invalid event type');

      if (event.isSuccess())
      {
         webSocketManager.connect();
         this.userLoggedIn = true;
      }
   }

   /**
    * Handle user login event
    * @param {Object} event - User data from login
    */
   handleLoginRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing login for user:', event);

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      let response = null;

      // Attempt login via API - move this to SystemEventHandler
      RB.fetchPostUnauthenticated('/api/auth/login', {...event.data})
         .then(success =>
         {
            console.log('Login success:', success);

            response = event.prepareResponse('system:loginResponse', {email: event.data.email}, 200);

            // Store JWT tokens if provided
            if (success.accessToken)
               localStorage.setItem('access_token', success.accessToken);

            if (success.refreshToken)
               localStorage.setItem('refresh_token', success.refreshToken);

            // Store user info (user_id is not stored - backend extracts it from JWT token)
            if (success.user)
            {
               localStorage.setItem('user_email', success.user.email);

               if (success.user.displayName)
                  localStorage.setItem('user_display_name', success.user.displayName);

               if (success.user.role)
                  localStorage.setItem('user_role', success.user.role);

               if (success.user.emailVerified !== undefined)
                  localStorage.setItem('user_email_verified', success.user.emailVerified.toString());
            }

            this.userLoggedIn = true;
            eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Login successful!', type: 'success'}));
         })
         .catch(error =>
         {
            console.error('Login error:', error);

            response = event.prepareResponse('system:loginResponse', {email: event.data.email}, 401, error.body);
            eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Login failed!', type: 'error'}));
         })
         .finally(() =>
         {
            console.log('Login finally', response);

            setTimeout(() => { eventBus.emit('system:loginResponse', response); }, 1000); // simulate network delay

            // eventBus.emit('system:loginResponse', response);
         });
   }

   handleLogoutRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing logout for user:', event);

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken)
         RB.fetchPost('/api/auth/logout', {refreshToken})
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
               this.userLoggedIn = false;

               localStorage.clear();
               webSocketManager.disconnect();
               eventBus.emit('ui:showScreen', new ApiEvent('ui:showScreen', {targetScreen: 'splash'}));
            });
   }

   /**
    * Handle user registration event
    * @param {ApiRequest} event - Registration request event
    */
   handleRegisterRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing registration for user:', event);

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      let response = null;

      RB.fetchPostUnauthenticated('/api/auth/register', {...event.data})
         .then(success =>
         {
            console.log('Registration success:', success);
            response = event.prepareResponse('system:registerResponse', success, 200, null);
            eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Registration successful! Logging you in...', type: 'success'}));
         })
         .catch(error =>
         {
            console.error('Registration error:', error);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message};
            response = event.prepareResponse('system:registerResponse', null, 400, errorBody);
            eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Registration failed!', type: 'error'}));
         })
         .finally(() =>
         {
            eventBus.emit('system:registerResponse', response);
         });
   }

   /**
    * Handle password recovery request event
    * @param {ApiRequest} event - Recovery request event
    */
   handleRecoverRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing recovery request for email:', event.data.email);

      let response = null;

      RB.fetchPostUnauthenticated('/api/auth/recover', {email: event.data.email})
         .then(success =>
         {
            console.log('Recovery request success:', success);
            response = event.prepareResponse('system:recoverResponse', success, 200, null);
            eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Recovery request successful!', type: 'success'}));
         })
         .catch(error =>
         {
            console.error('Recovery request error:', error);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message};
            response = event.prepareResponse('system:recoverResponse', null, 400, errorBody);
            eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Recovery request failed!', type: 'error'}));
         })
         .finally(() =>
         {
            eventBus.emit('system:recoverResponse', response);
         });
   }

   /**
    * Handle password reset request event
    * @param {ApiRequest} event - Reset password request event
    */
   handleResetPasswordRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing password reset');

      let response = null;

      RB.fetchPostUnauthenticated('/api/auth/reset-password', {token: event.data.token, newPassword: event.data.newPassword})
         .then(success =>
         {
            console.log('Password reset success:', success);
            response = event.prepareResponse('system:resetPasswordResponse', success, 200, null);
            eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Password reset successful!', type: 'success'}));
         })
         .catch(error =>
         {
            console.error('Password reset error:', error);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message};
            response = event.prepareResponse('system:resetPasswordResponse', null, 400, errorBody);
            eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Password reset failed!', type: 'error'}));
         })
         .finally(() =>
         {
            eventBus.emit('system:resetPasswordResponse', response);
         });
   }

   dispose()
   {
      eventBus.off('system:loginRequest', this.handleLoginRequest.bind(this));
      eventBus.off('system:loginResponse', this.handleLoginResponse.bind(this));
      eventBus.off('system:registerRequest', this.handleRegisterRequest.bind(this));
      eventBus.off('system:recoverRequest', this.handleRecoverRequest.bind(this));
      eventBus.off('system:resetPasswordRequest', this.handleResetPasswordRequest.bind(this));
      eventBus.off('system:allAssetsLoaded', this.handleAllAssetsLoaded.bind(this));
      eventBus.off('system:logoutRequest', this.handleLogoutRequest.bind(this));
   }
}
