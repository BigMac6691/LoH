/**
 * System Event Handler - Manages system-level events and context
 * Handles user login, game selection, and other system-wide events
 */
import { eventBus }from '../eventBus.js';
import { ApiEvent, ApiRequest, ApiResponse } from './Events.js';
import { RB, ApiError } from '../utils/RequestBuilder.js';

export class SystemEventHandler
{
   constructor()
   {
      this.userLoggedIn = false;

      this.setupEventListeners();
   }

   /**
    * Set up event listeners for system events
    */
   setupEventListeners()
   {
      eventBus.on('system:loginRequest', this.handleLoginRequest.bind(this));
      eventBus.on('system:registerRequest', this.handleRegisterRequest.bind(this));
      eventBus.on('system:recoverRequest', this.handleRecoverRequest.bind(this));
      eventBus.on('system:resetPasswordRequest', this.handleResetPasswordRequest.bind(this));
      eventBus.on('system:allAssetsLoaded', this.handleAllAssetsLoaded.bind(this));
      eventBus.on('system:loginResponse', this.handleLoginResponse.bind(this)); // Track login success
   }

   /**
    * Handle all assets loaded event, if no user has logged in, emit system:systemReady event
    * @param {ApiResponse} event - Event object
    */
   handleAllAssetsLoaded(event)
   {
      console.log('🔐 SystemEventHandler: All assets loaded:', event, event.response);

      if (!this.userLoggedIn)
         eventBus.emit('system:systemReady', new ApiEvent('system:systemReady'));
   }

   /**
    * Handle login response to track login status
    * @param {ApiResponse} event - Login response event
    */
   handleLoginResponse(event)
   {
      if (event.isSuccess())
         this.userLoggedIn = true;
   }

   /**
    * Handle user login event
    * @param {Object} event - User data from login
    */
   handleLoginRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing login for user:', event);

      let response = null;

      // Attempt login via API - move this to SystemEventHandler
      RB.fetchPostUnauthenticated('/api/auth/login', {...event.request})
         .then(success =>
         {
            console.log('Login success:', success);

            response = new ApiResponse('system:loginResponse', {email: event.request.email}, 200);

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
         })
         .catch(error =>
         {
            console.error('Login error:', error);
            console.log('Login error body:', error.body);
            console.log(error instanceof ApiError ? 'ApiError' : 'Not ApiError');

            response = new ApiResponse('system:loginResponse', {email: event.request.email}, 401, error.body);
         })
         .finally(() =>
         {
            console.log('Login finally', response);

            eventBus.emit('system:loginResponse', response);
         });
   }

   /**
    * Handle user registration event
    * @param {ApiRequest} event - Registration request event
    */
   handleRegisterRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing registration for user:', event);

      let response = null;

      RB.fetchPostUnauthenticated('/api/auth/register', {...event.request})
         .then(success =>
         {
            console.log('Registration success:', success);
            response = new ApiResponse('system:registerResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Registration error:', error);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message};
            response = new ApiResponse('system:registerResponse', null, 400, errorBody);
         })
         .finally(() =>
         {
            // Include request data in response for auto-login if needed
            response.request = event.request;
            eventBus.emit('system:registerResponse', response);
         });
   }

   /**
    * Handle password recovery request event
    * @param {ApiRequest} event - Recovery request event
    */
   handleRecoverRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing recovery request for email:', event.request.email);

      let response = null;

      RB.fetchPostUnauthenticated('/api/auth/recover', {email: event.request.email})
         .then(success =>
         {
            console.log('Recovery request success:', success);
            response = new ApiResponse('system:recoverResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Recovery request error:', error);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message};
            response = new ApiResponse('system:recoverResponse', null, 400, errorBody);
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

      RB.fetchPostUnauthenticated('/api/auth/reset-password', {
         token: event.request.token,
         newPassword: event.request.newPassword
      })
         .then(success =>
         {
            console.log('Password reset success:', success);
            response = new ApiResponse('system:resetPasswordResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Password reset error:', error);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message};
            response = new ApiResponse('system:resetPasswordResponse', null, 400, errorBody);
         })
         .finally(() =>
         {
            eventBus.emit('system:resetPasswordResponse', response);
         });
   }

   /**
    * Clean up event listeners
    */
   dispose()
   {
      eventBus.off('system:loginRequest', this.handleLoginRequest.bind(this));
      eventBus.off('system:registerRequest', this.handleRegisterRequest.bind(this));
      eventBus.off('system:recoverRequest', this.handleRecoverRequest.bind(this));
      eventBus.off('system:resetPasswordRequest', this.handleResetPasswordRequest.bind(this));
      eventBus.off('system:allAssetsLoaded', this.handleAllAssetsLoaded.bind(this));
      eventBus.off('system:loginResponse', this.handleLoginResponse.bind(this));
   }
}
