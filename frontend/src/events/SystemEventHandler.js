/**
 * System Event Handler - Manages system-level events and context
 * Handles user login, game selection, and other system-wide events
 */
import { eventBus }from '../eventBus.js';
import { ApiEvent, ApiRequest, ApiResponse } from './Events.js';
import { RB, ApiError } from '../utils/RequestBuilder.js';
import { EventRegister } from '../EventRegister.js';

export class SystemEventHandler
{
   constructor()
   {
      this.eventRegister = new EventRegister();

      this.eventRegister.registerEventHandler('system:registerRequest', this.handleRegisterRequest.bind(this));
      this.eventRegister.registerEventHandler('system:recoverRequest', this.handleRecoverRequest.bind(this));
      this.eventRegister.registerEventHandler('system:resetPasswordRequest', this.handleResetPasswordRequest.bind(this));
      this.eventRegister.registerEventHandler('system:allAssetsLoaded', this.handleAllAssetsLoaded.bind(this)); // not a request
      this.eventRegister.registerEventHandler('system:profileRequest', this.handleProfileRequest.bind(this));
      this.eventRegister.registerEventHandler('system:updateProfileRequest', this.handleUpdateProfileRequest.bind(this));
      this.eventRegister.registerEventHandler('system:changePasswordRequest', this.handleChangePasswordRequest.bind(this));
      this.eventRegister.registerEventHandler('system:verifyEmailRequest', this.handleVerifyEmailRequest.bind(this));
      this.eventRegister.registerEventHandler('system:resendVerificationRequest', this.handleResendVerificationRequest.bind(this));
      this.eventRegister.registerEventHandler('system:systemEventsRequest', this.handleSystemEventsRequest.bind(this));
      this.eventRegister.registerEventHandler('system:gamesPlayingRequest', this.handleGamesPlayingRequest.bind(this));
      this.eventRegister.registerEventHandler('system:gamesAvailableRequest', this.handleGamesAvailableRequest.bind(this));
      this.eventRegister.registerEventHandler('system:joinGameRequest', this.handleJoinGameRequest.bind(this));
      this.eventRegister.registerEventHandler('system:createGameRequest', this.handleCreateGameRequest.bind(this));
   }

   /**
    * Handle all assets loaded event, if no user has logged in, emit system:systemReady event
    * @param {ApiResponse} event - Event object
    */
   handleAllAssetsLoaded(event)
   {
      console.log('🔐 SystemEventHandler: All assets loaded:', event, event.data);

      eventBus.emit('system:systemReady', new ApiEvent('system:systemReady'));
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

      RB.fetchPostUnauthenticated('/api/auth/register', {...event.data}, event.signal)
         .then(success =>
         {
            console.log('Registration success:', success);
            response = event.prepareResponse('system:registerResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Registration error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:registerResponse', null, status, errorBody);
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

      RB.fetchPostUnauthenticated('/api/auth/recover', {email: event.data.email}, event.signal)
         .then(success =>
         {
            console.log('Recovery request success:', success);
            response = event.prepareResponse('system:recoverResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Recovery request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:recoverResponse', null, status, errorBody);
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

      RB.fetchPostUnauthenticated('/api/auth/reset-password', {token: event.data.token, newPassword: event.data.newPassword}, event.signal)
         .then(success =>
         {
            console.log('Password reset success:', success);
            response = event.prepareResponse('system:resetPasswordResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Password reset error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:resetPasswordResponse', null, status, errorBody);
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

      RB.fetchGet('/api/auth/profile', event.signal)
         .then(success =>
         {
            console.log('Profile request success:', success);
            response = event.prepareResponse('system:profileResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Profile request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:profileResponse', null, status, errorBody);
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

      RB.fetchPut('/api/auth/profile', {...event.data}, event.signal)
         .then(success =>
         {
            console.log('Update profile success:', success);
            response = event.prepareResponse('system:updateProfileResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Update profile error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:updateProfileResponse', null, status, errorBody);
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

      RB.fetchPost('/api/auth/change-password', {...event.data}, event.signal)
         .then(success =>
         {
            console.log('Change password success:', success);
            response = event.prepareResponse('system:changePasswordResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Change password error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:changePasswordResponse', null, status, errorBody);
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

      RB.fetchPost('/api/auth/verify-email', {...event.data}, event.signal)
         .then(success =>
         {
            response = event.prepareResponse('system:verifyEmailResponse', success, 200, null);
         })
         .catch(error =>
         {
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:verifyEmailResponse', null, status, errorBody);
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
      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      let response = null;

      RB.fetchPost('/api/auth/profile/resend-verification', null, event.signal)
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

   /**
    * Handle system events request event
    * @param {ApiRequest} event - System events request event
    */
   handleSystemEventsRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing system events request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      let response = null;

      const { page = 1, limit = 10 } = event.data || {};
      const queryParams = `?page=${page}&limit=${limit}`;

      RB.fetchGet(`/api/system-events${queryParams}`, event.signal)
         .then(success =>
         {
            console.log('System events request success:', success);
            response = event.prepareResponse('system:systemEventsResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('System events request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:systemEventsResponse', null, status, errorBody);
         })
         .finally(() =>
         {
            eventBus.emit('system:systemEventsResponse', response);
         });
   }

   /**
    * Handle games playing request event
    * @param {ApiRequest} event - Games playing request event
    */
   handleGamesPlayingRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing games playing request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      let response = null;

      RB.fetchGet('/api/games/playing', event.signal)
         .then(success =>
         {
            console.log('Games playing request success:', success);
            response = event.prepareResponse('system:gamesPlayingResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Games playing request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:gamesPlayingResponse', null, status, errorBody);
         })
         .finally(() =>
         {
            eventBus.emit('system:gamesPlayingResponse', response);
         });
   }

   /**
    * Handle games available request event
    * @param {ApiRequest} event - Games available request event
    */
   handleGamesAvailableRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing games available request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      let response = null;

      RB.fetchGet('/api/games/available', event.signal)
         .then(success =>
         {
            console.log('Games available request success:', success);
            response = event.prepareResponse('system:gamesAvailableResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Games available request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:gamesAvailableResponse', null, status, errorBody);
         })
         .finally(() =>
         {
            eventBus.emit('system:gamesAvailableResponse', response);
         });
   }

   /**
    * Handle join game request event
    * @param {ApiRequest} event - Join game request event
    */
   handleJoinGameRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing join game request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      const { gameId, countryName } = event.data || {};

      if (!gameId)
      {
         const errorResponse = event.prepareResponse('system:joinGameResponse', null, 400, {message: 'Game ID is required'});
         eventBus.emit('system:joinGameResponse', errorResponse);
         return;
      }

      if (!countryName || !countryName.trim())
      {
         const errorResponse = event.prepareResponse('system:joinGameResponse', null, 400, {message: 'Country name is required'});
         eventBus.emit('system:joinGameResponse', errorResponse);
         return;
      }

      let response = null;

      RB.fetchPost(`/api/games/${gameId}/join`, {countryName: countryName.trim()}, event.signal)
         .then(success =>
         {
            console.log('Join game request success:', success);
            response = event.prepareResponse('system:joinGameResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Join game request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:joinGameResponse', null, status, errorBody);
         })
         .finally(() =>
         {
            eventBus.emit('system:joinGameResponse', response);
         });
   }

   /**
    * Handle create game request event
    * @param {ApiRequest} event - Create game request event
    */
   handleCreateGameRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing create game request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      const { seed, mapSize, densityMin, densityMax, title, description, maxPlayers } = event.data || {};

      if (!title || !title.trim())
      {
         const errorResponse = event.prepareResponse('system:createGameResponse', null, 400, {message: 'Title is required'});
         eventBus.emit('system:createGameResponse', errorResponse);
         return;
      }

      if (!description || !description.trim())
      {
         const errorResponse = event.prepareResponse('system:createGameResponse', null, 400, {message: 'Description is required'});
         eventBus.emit('system:createGameResponse', errorResponse);
         return;
      }

      if (!seed || !seed.trim())
      {
         const errorResponse = event.prepareResponse('system:createGameResponse', null, 400, {message: 'Seed is required'});
         eventBus.emit('system:createGameResponse', errorResponse);
         return;
      }

      let response = null;

      RB.fetchPost('/api/games', {seed, mapSize, densityMin, densityMax, title, description, maxPlayers, status: 'lobby', params: {}}, event.signal)
         .then(success =>
         {
            console.log('Create game request success:', success);
            response = event.prepareResponse('system:createGameResponse', success, 200, null);
         })
         .catch(error =>
         {
            console.error('Create game request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:createGameResponse', null, status, errorBody);
         })
         .finally(() =>
         {
            eventBus.emit('system:createGameResponse', response);
         });
   }

   dispose()
   {
      this.eventRegister.unregisterEventHandlers();
   }
}
