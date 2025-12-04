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
      eventBus.on('system:allAssetsLoaded', this.handleAllAssetsLoaded.bind(this));
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

            response = new ApiResponse('system:loginResponse', null, 200);

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
    * Clean up event listeners
    */
   dispose()
   {
      eventBus.off('system:loginRequest', this.handleLoginRequest.bind(this));
      eventBus.off('system:allAssetsLoaded', this.handleAllAssetsLoaded.bind(this));
   }
}
