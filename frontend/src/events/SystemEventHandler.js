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
      eventBus.on('system:loginResponse', this.handleLoginResponse.bind(this)); // not a request
      eventBus.on('system:registerRequest', this.handleRegisterRequest.bind(this));
      eventBus.on('system:recoverRequest', this.handleRecoverRequest.bind(this));
      eventBus.on('system:resetPasswordRequest', this.handleResetPasswordRequest.bind(this));
      eventBus.on('system:allAssetsLoaded', this.handleAllAssetsLoaded.bind(this)); // not a request
      eventBus.on('system:logoutRequest', this.handleLogoutRequest.bind(this));
      eventBus.on('system:profileRequest', this.handleProfileRequest.bind(this));
      eventBus.on('system:updateProfileRequest', this.handleUpdateProfileRequest.bind(this));
      eventBus.on('system:changePasswordRequest', this.handleChangePasswordRequest.bind(this));
      eventBus.on('system:verifyEmailRequest', this.handleVerifyEmailRequest.bind(this));
      eventBus.on('system:resendVerificationRequest', this.handleResendVerificationRequest.bind(this));
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
         })
         .catch(error =>
         {
            console.error('Login error:', error);

            response = event.prepareResponse('system:loginResponse', {email: event.data.email}, 401, error.body);
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
         })
         .catch(error =>
         {
            console.error('Registration error:', error);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message};
            response = event.prepareResponse('system:registerResponse', null, 400, errorBody);
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
         })
         .catch(error =>
         {
            console.error('Recovery request error:', error);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message};
            response = event.prepareResponse('system:recoverResponse', null, 400, errorBody);
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
         })
         .catch(error =>
         {
            console.error('Password reset error:', error);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message};
            response = event.prepareResponse('system:resetPasswordResponse', null, 400, errorBody);
         })
         .finally(() =>
         {
            eventBus.emit('system:resetPasswordResponse', response);
         });
   }

   /**
    * Handle profile request event
    * @param {ApiRequest} event - Profile request event
    */
   handleProfileRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing profile request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      let response = null;

      RB.fetchGet('/api/auth/profile')
         .then(success =>
         {
            console.log('Profile request success:', success);
            response = event.prepareResponse('system:profileResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Profile request error:', error);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message};
            response = event.prepareResponse('system:profileResponse', null, 400, errorBody);
         })
         .finally(() =>
         {
            eventBus.emit('system:profileResponse', response);
         });
   }

   /**
    * Handle update profile request event
    * @param {ApiRequest} event - Update profile request event
    */
   handleUpdateProfileRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing update profile request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      let response = null;

      RB.fetchPut('/api/auth/profile', {...event.data})
         .then(success =>
         {
            console.log('Update profile success:', success);
            response = event.prepareResponse('system:updateProfileResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Update profile error:', error);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message};
            response = event.prepareResponse('system:updateProfileResponse', null, 400, errorBody);
         })
         .finally(() =>
         {
            eventBus.emit('system:updateProfileResponse', response);
         });
   }

   /**
    * Handle change password request event
    * @param {ApiRequest} event - Change password request event
    */
   handleChangePasswordRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing change password request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      let response = null;

      RB.fetchPost('/api/auth/change-password', {...event.data})
         .then(success =>
         {
            console.log('Change password success:', success);
            response = event.prepareResponse('system:changePasswordResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Change password error:', error);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message};
            response = event.prepareResponse('system:changePasswordResponse', null, 400, errorBody);
         })
         .finally(() =>
         {
            eventBus.emit('system:changePasswordResponse', response);
         });
   }

   /**
    * Handle verify email request event
    * @param {ApiRequest} event - Verify email request event
    */
   handleVerifyEmailRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing verify email request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      let response = null;

      RB.fetchPost('/api/auth/verify-email', {...event.data})
         .then(success =>
         {
            console.log('Verify email success:', success);
            response = event.prepareResponse('system:verifyEmailResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Verify email error:', error);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message};
            response = event.prepareResponse('system:verifyEmailResponse', null, 400, errorBody);
         })
         .finally(() =>
         {
            eventBus.emit('system:verifyEmailResponse', response);
         });
   }

   /**
    * Handle resend verification request event
    * @param {ApiRequest} event - Resend verification request event
    */
   handleResendVerificationRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing resend verification request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      let response = null;

      RB.fetchPost('/api/auth/profile/resend-verification', null)
         .then(success =>
         {
            console.log('Resend verification success:', success);
            response = event.prepareResponse('system:resendVerificationResponse', success, 200, null);
            eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Verification token sent!', type: 'success'}));
         })
         .catch(error =>
         {
            console.error('Resend verification error:', error);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message};
            response = event.prepareResponse('system:resendVerificationResponse', null, 400, errorBody);
            eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Failed to send verification token!', type: 'error'}));
         })
         .finally(() =>
         {
            eventBus.emit('system:resendVerificationResponse', response);
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
      eventBus.off('system:profileRequest', this.handleProfileRequest.bind(this));
      eventBus.off('system:updateProfileRequest', this.handleUpdateProfileRequest.bind(this));
      eventBus.off('system:changePasswordRequest', this.handleChangePasswordRequest.bind(this));
      eventBus.off('system:verifyEmailRequest', this.handleVerifyEmailRequest.bind(this));
      eventBus.off('system:resendVerificationRequest', this.handleResendVerificationRequest.bind(this));
   }
}
