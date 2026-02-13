/**
 * System Event Handler - Manages system-level events and context
 * Handles user login, game selection, and other system-wide events
 */
import { eventBus }from '../eventBus.js';
import { ApiEvent, ApiRequest, ApiResponse } from './Events.js';
import { RB, ApiError } from '../utils/RequestBuilder.js';
import { EventRegister } from '../EventRegister.js';
import { ClientLogger as logger } from '../utils/ClientLogger.js';

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
      this.eventRegister.registerEventHandler('system:listGames', this.handleListGames.bind(this));
      this.eventRegister.registerEventHandler('system:joinGameRequest', this.handleJoinGameRequest.bind(this));
      this.eventRegister.registerEventHandler('system:createGameRequest', this.handleCreateGameRequest.bind(this));
      this.eventRegister.registerEventHandler('system:listGamePlayers', this.handleListGamePlayers.bind(this));
      this.eventRegister.registerEventHandler('system:startGameRequest', this.handleStartGameRequest.bind(this));
      this.eventRegister.registerEventHandler('system:updateGameStatus', this.handleUpdateGameStatus.bind(this));
      this.eventRegister.registerEventHandler('system:endPlayerTurn', this.handleEndPlayerTurn.bind(this));
      this.eventRegister.registerEventHandler('system:updatePlayerStatus', this.handleUpdatePlayerStatus.bind(this));
      this.eventRegister.registerEventHandler('system:updatePlayerMetaRequest', this.handleUpdatePlayerMetaRequest.bind(this));
      this.eventRegister.registerEventHandler('system:listAI', this.handleListAI.bind(this));
      this.eventRegister.registerEventHandler('system:addAIPlayerRequest', this.handleAddAIPlayerRequest.bind(this));
   }

   normalizeResponse(success)
   {
      console.log('🔐 SystemEventHandler: Normalizing response', success);

      if (success && typeof success === 'object' && 'data' in success && 'correlationId' in success)
         return success;

      const correlationId = success && typeof success === 'object'
         ? (success.__correlationId || success.correlationId || null)
         : null;

      return { data: success, correlationId: correlationId };
   }

   applyCorrelationId(response, correlationId)
   {
      if (response)
         response.correlationId = correlationId || null;
   }

   /**
    * Handle all assets loaded event, if no user has logged in, emit system:systemReady event
    * @param {ApiResponse} event - Event object
    */
   handleAllAssetsLoaded(event)
   {
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
      let correlationId = null;

      RB.fetchPostUnauthenticated('/api/auth/register', {...event.data}, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('Registration success:', normalized.data);
            response = event.prepareResponse('system:registerResponse', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('Registration error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:registerResponse', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
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
      let correlationId = null;

      RB.fetchPostUnauthenticated('/api/auth/recover', {email: event.data.email}, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('Recovery request success:', normalized.data);
            response = event.prepareResponse('system:recoverResponse', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('Recovery request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:recoverResponse', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
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
      let correlationId = null;

      RB.fetchPostUnauthenticated('/api/auth/reset-password', {token: event.data.token, newPassword: event.data.newPassword}, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('Password reset success:', normalized.data);
            response = event.prepareResponse('system:resetPasswordResponse', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('Password reset error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:resetPasswordResponse', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
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
      let correlationId = null;

      RB.fetchGet('/api/auth/profile', event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('Profile request success:', normalized.data);
            response = event.prepareResponse('system:profileResponse', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('Profile request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:profileResponse', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
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
      let correlationId = null;

      RB.fetchPut('/api/auth/profile', {...event.data}, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('Update profile success:', normalized.data);
            response = event.prepareResponse('system:updateProfileResponse', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('Update profile error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:updateProfileResponse', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
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
      let correlationId = null;

      RB.fetchPost('/api/auth/change-password', {...event.data}, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('Change password success:', normalized.data);
            response = event.prepareResponse('system:changePasswordResponse', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('Change password error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:changePasswordResponse', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
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
      let correlationId = null;

      RB.fetchPost('/api/auth/verify-email', {...event.data}, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            response = event.prepareResponse('system:verifyEmailResponse', normalized.data, 200, null);
         })
         .catch(error =>
         {
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:verifyEmailResponse', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
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
      let correlationId = null;

      RB.fetchPost('/api/auth/profile/resend-verification', null, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('Resend verification success:', normalized.data);
            response = event.prepareResponse('system:resendVerificationResponse', normalized.data, 200, null);
            eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Verification token sent!', type: 'success'}));
         })
         .catch(error =>
         {
            console.error('Resend verification error:', error);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message};
            response = event.prepareResponse('system:resendVerificationResponse', null, 400, errorBody);
            correlationId = error?.correlationId || null;
            eventBus.emit('ui:statusMessage', new ApiEvent('ui:statusMessage', {message: 'Failed to send verification token!', type: 'error'}));
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
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
      let correlationId = null;

      const { page = 1, limit = 10 } = event.data || {};
      const queryParams = `?page=${page}&limit=${limit}`;

      RB.fetchGet(`/api/system-events${queryParams}`, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('System events request success:', normalized.data);
            response = event.prepareResponse('system:systemEventsResponse', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('System events request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:systemEventsResponse', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
            eventBus.emit('system:systemEventsResponse', response);
         });
   }

  /**
   * Handle list games request event (unified handler for all game list requests)
   * @param {ApiRequest} event - List games request event
   * 
   * Event data should contain:
   *   - filter: 'playing' | 'available' | 'manage' | 'all' (required)
   *   - context: string identifying the caller (e.g., class name) (required)
   *   - page: page number (default: 1)
   *   - limit: items per page (default: 5)
   * 
   * Response will include the context for filtering purposes.
   */
  handleListGames(event)
  {
     let response = null;
     let correlationId = null;
     const { filter, page = 1, limit = 5 } = event.data || {};

     if(!(event instanceof ApiRequest))
     {
        const trxId = event.transactionId || crypto.randomUUID();
        
        response = new ApiResponse('system:gameList', {error: 'Internal client error', level: 'fatal'}, 400);
        response.transactionId = trxId;

        logger.error(`SystemEventHandler: handleListGames: tracking id=${trxId}: Event must be an ApiRequest`, event);
     }
     else if (!['playing', 'available', 'manage', 'all'].includes(filter)) // Validate filter
     {
        response = event.prepareResponse('system:gameList', {error: 'Internal client error', level: 'fatal'}, 400);

        logger.error(`SystemEventHandler: handleListGames: tracking id=${event.transactionId}: Invalid filter value: ${filter}`, event);
     }

     if(response !== null)
        return eventBus.emit('system:gameList', response); // void function

     const queryParams = `?filter=${filter}&page=${page}&limit=${limit}`;

     RB.fetchGet(`/api/games/list${queryParams}`, event.signal, event.transactionId)
        .then(success =>
        {
           const normalized = this.normalizeResponse(success);
           correlationId = normalized.correlationId;
           const data = normalized.data;
           console.log(`List games request success (filter=${filter}):`, data);
           // Unified endpoint returns { success, games, pagination }
           // Include context in response for filtering
           const transformedResponse = 
           {
              filter: filter,
              games: data.games || [],
              pagination: data.pagination
           };
           response = event.prepareResponse('system:gameList', transformedResponse, 200);
        })
        .catch(error =>
        { // TODO: need to put some serious thought into this error handling, handling my errors is easy it's handling other's errors that is the challenge
          // general rule is log details but report safe but clear messages to the user, I own ApiError
           console.error(`List games request error (filter=${filter}):`, error);
           const status = event.signal?.aborted ? 499 : 400;
           const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
           response = event.prepareResponse('system:gameList', errorBody, status);
           correlationId = error?.correlationId || null;
        })
        .finally(() =>
        {
           this.applyCorrelationId(response, correlationId);
           eventBus.emit('system:gameList', response);
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
      let correlationId = null;

      RB.fetchPost(`/api/games/${gameId}/join`, {countryName: countryName.trim()}, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('Join game request success:', normalized.data);
            response = event.prepareResponse('system:joinGameResponse', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('Join game request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:joinGameResponse', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
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
      let correlationId = null;

      RB.fetchPost('/api/games', {seed, mapSize, densityMin, densityMax, title, description, maxPlayers, status: 'lobby', params: {}}, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('Create game request success:', normalized.data);
            response = event.prepareResponse('system:createGameResponse', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('Create game request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:createGameResponse', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
            eventBus.emit('system:createGameResponse', response);
         });
   }


   /**
    * Handle manage game players request event
    * @param {ApiRequest} event - Manage game players request event
    */
   handleListGamePlayers(event)
   {
      console.log('🔐 SystemEventHandler: Processing list game players request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      const { gameId } = event.data || {};

      if (!gameId)
      {
         const errorResponse = event.prepareResponse('system:gamePlayerList', null, 400, {message: 'Game ID is required'});
         eventBus.emit('system:gamePlayerList', errorResponse);
         return;
      }

      let response = null;
      let correlationId = null;

      RB.fetchGet(`/api/games/${gameId}/manage/players`, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('List game players request success:', normalized.data);
            response = event.prepareResponse('system:gamePlayerList', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('List game players request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:gamePlayerList', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
            eventBus.emit('system:gamePlayerList', response);
         });
   }

   /**
    * Handle start game request event
    * @param {ApiRequest} event - Start game request event
    */
   handleStartGameRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing start game request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      const { gameId, version } = event.data || {};

      if (!gameId)
      {
         const errorResponse = event.prepareResponse('system:startGameResponse', null, 400, {message: 'Game ID is required'});
         eventBus.emit('system:startGameResponse', errorResponse);
         return;
      }

      let response = null;
      let correlationId = null;

      RB.fetchPost(`/api/games/${gameId}/startGame`, {version: version}, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('Start game request success:', normalized.data);
            // On 202 Accepted, emit updateGameStatusResponse with creating status
            if (normalized.data.status === 'creating')
            {
               const statusResponse = event.prepareResponse('system:updateGameStatusResponse', {
                  success: true,
                  game: {
                     id: gameId,
                     status: 'creating',
                     substatus: null
                  }
               }, 202, null);
               this.applyCorrelationId(statusResponse, correlationId);
               eventBus.emit('system:updateGameStatusResponse', statusResponse);
            }
            response = event.prepareResponse('system:startGameResponse', normalized.data, 202, null);
         })
         .catch(error =>
         {
            console.error('Start game request error:', error);
            const status = event.signal?.aborted ? 499 : (error.status || 400);
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:startGameResponse', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
            eventBus.emit('system:startGameResponse', response);
         });
   }

   /**
    * Handle update game status request event
    * @param {ApiRequest} event - Update game status request event
    */
   handleUpdateGameStatus(event)
   {
      console.log('🔐 SystemEventHandler: Processing update game status request', event);

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      const { gameId, status, statusReason, version } = event.data || {};

      if (!gameId)
      {
         const errorResponse = event.prepareResponse('system:updateGameStatusResponse', null, 400, {message: 'Game ID is required'});
         eventBus.emit('system:updateGameStatusResponse', errorResponse);
         return;
      }

      if (!status)
      {
         const errorResponse = event.prepareResponse('system:updateGameStatusResponse', null, 400, {message: 'Status is required'});
         eventBus.emit('system:updateGameStatusResponse', errorResponse);
         return;
      }

      if (!version)
      {
         const errorResponse = event.prepareResponse('system:updateGameStatusResponse', null, 400, {message: 'Version is required'});
         eventBus.emit('system:updateGameStatusResponse', errorResponse);
         return;
      }

      let response = null;
      let correlationId = null;

      const requestBody = { status, version };
      if (statusReason !== null && statusReason !== undefined)
         requestBody.statusReason = statusReason;

      RB.fetchPut(`/api/games/${gameId}/status`, requestBody, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('Update game status request success:', normalized.data);
            response = event.prepareResponse('system:gameUpdated', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('Update game status request error:', {message: error.message, status: error.status, body: error.body}, error, error instanceof ApiError ? 'ApiError' : 'NOT ApiError');
            const status = event.signal?.aborted ? 499 : error.status || 400;
            const body = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:gameUpdated', body, status);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
            eventBus.emitEvent(response);
         });
   }

   /**
    * Handle end player turn request event
    * @param {ApiRequest} event - End player turn request event
    */
   handleEndPlayerTurn(event)
   {
      console.log('🔐 SystemEventHandler: Processing end player turn request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      const { gameId, playerId, reason } = event.data || {};

      if (!gameId)
      {
         const errorResponse = event.prepareResponse('system:endPlayerTurnResponse', null, 400, {message: 'Game ID is required'});
         eventBus.emit('system:endPlayerTurnResponse', errorResponse);
         return;
      }

      if (!playerId)
      {
         const errorResponse = event.prepareResponse('system:endPlayerTurnResponse', null, 400, {message: 'Player ID is required'});
         eventBus.emit('system:endPlayerTurnResponse', errorResponse);
         return;
      }

      let response = null;
      let correlationId = null;

      // Include reason in request body if provided
      const requestBody = {};
      if (reason !== null && reason !== undefined)
         requestBody.reason = reason;

      RB.fetchPost(`/api/games/${gameId}/players/${playerId}/end-turn`, requestBody, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('End player turn request success:', normalized.data);
            response = event.prepareResponse('system:endPlayerTurnResponse', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('End player turn request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:endPlayerTurnResponse', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
            eventBus.emit('system:endPlayerTurnResponse', response);
         });
   }

   /**
    * Handle update player status request event
    * @param {ApiRequest} event - Update player status request event
    */
   handleUpdatePlayerStatus(event)
   {
      console.log('🔐 SystemEventHandler: Processing update player status request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      const { gameId, playerId, status, statusReason } = event.data || {};

      if (!gameId)
      {
         const errorResponse = event.prepareResponse('system:updatePlayerStatusResponse', null, 400, {message: 'Game ID is required'});
         eventBus.emit('system:updatePlayerStatusResponse', errorResponse);
         return;
      }

      if (!playerId)
      {
         const errorResponse = event.prepareResponse('system:updatePlayerStatusResponse', null, 400, {message: 'Player ID is required'});
         eventBus.emit('system:updatePlayerStatusResponse', errorResponse);
         return;
      }

      if (!status)
      {
         const errorResponse = event.prepareResponse('system:updatePlayerStatusResponse', null, 400, {message: 'Status is required'});
         eventBus.emit('system:updatePlayerStatusResponse', errorResponse);
         return;
      }

      let response = null;
      let correlationId = null;

      const requestBody = {status};
      if (statusReason !== null && statusReason !== undefined)
         requestBody.statusReason = statusReason;

      RB.fetchPut(`/api/games/${gameId}/players/${playerId}/status`, requestBody, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('Update player status request success:', normalized.data);
            response = event.prepareResponse('system:updatePlayerStatusResponse', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('Update player status request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:updatePlayerStatusResponse', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
            eventBus.emit('system:updatePlayerStatusResponse', response);
         });
   }

   /**
    * Handle update player meta request event
    * @param {ApiRequest} event - Update player meta request event
    */
   handleUpdatePlayerMetaRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing update player meta request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      const { gameId, playerId, meta } = event.data || {};

      if (!gameId)
      {
         const errorResponse = event.prepareResponse('system:updatePlayerMetaResponse', null, 400, {message: 'Game ID is required'});
         eventBus.emit('system:updatePlayerMetaResponse', errorResponse);
         return;
      }

      if (!playerId)
      {
         const errorResponse = event.prepareResponse('system:updatePlayerMetaResponse', null, 400, {message: 'Player ID is required'});
         eventBus.emit('system:updatePlayerMetaResponse', errorResponse);
         return;
      }

      if (meta === undefined || meta === null)
      {
         const errorResponse = event.prepareResponse('system:updatePlayerMetaResponse', null, 400, {message: 'Meta is required'});
         eventBus.emit('system:updatePlayerMetaResponse', errorResponse);
         return;
      }

      let response = null;
      let correlationId = null;

      RB.fetchPut(`/api/games/${gameId}/players/${playerId}/meta`, {meta}, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('Update player meta request success:', normalized.data);
            response = event.prepareResponse('system:updatePlayerMetaResponse', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('Update player meta request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:updatePlayerMetaResponse', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
            eventBus.emit('system:updatePlayerMetaResponse', response);
         });
   }

   /**
    * Handle AI list request event
    * @param {ApiRequest} event - AI list request event
    */
   handleListAI(event)
   {
      console.log('🔐 SystemEventHandler: Processing AI list request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      let response = null;
      let correlationId = null;

      RB.fetchGet('/api/ai/list', event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('AI list request success:', normalized.data);
            response = event.prepareResponse('system:aiList', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('AI list request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:aiList', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
            eventBus.emit('system:aiList', response);
         });
   }

   /**
    * Handle add AI player request event
    * @param {ApiRequest} event - Add AI player request event
    */
   handleAddAIPlayerRequest(event)
   {
      console.log('🔐 SystemEventHandler: Processing add AI player request');

      if(!(event instanceof ApiRequest))
         throw new Error('SystemEventHandler: Invalid event type');

      const { gameId, aiName, playerName, countryName, aiConfig } = event.data || {};

      if (!gameId)
      {
         const errorResponse = event.prepareResponse('system:addAIPlayerResponse', null, 400, {message: 'Game ID is required'});
         eventBus.emit('system:addAIPlayerResponse', errorResponse);
         return;
      }

      if (!aiName || !aiName.trim())
      {
         const errorResponse = event.prepareResponse('system:addAIPlayerResponse', null, 400, {message: 'AI name is required'});
         eventBus.emit('system:addAIPlayerResponse', errorResponse);
         return;
      }

      if (!playerName || !playerName.trim())
      {
         const errorResponse = event.prepareResponse('system:addAIPlayerResponse', null, 400, {message: 'Player name is required'});
         eventBus.emit('system:addAIPlayerResponse', errorResponse);
         return;
      }

      if (!countryName || !countryName.trim())
      {
         const errorResponse = event.prepareResponse('system:addAIPlayerResponse', null, 400, {message: 'Country name is required'});
         eventBus.emit('system:addAIPlayerResponse', errorResponse);
         return;
      }

      let response = null;
      let correlationId = null;

      RB.fetchPost(`/api/games/${gameId}/ai-players`, {aiName, playerName, countryName, aiConfig: aiConfig || {}}, event.signal, event.transactionId)
         .then(success =>
         {
            const normalized = this.normalizeResponse(success);
            correlationId = normalized.correlationId;
            console.log('Add AI player request success:', normalized.data);
            response = event.prepareResponse('system:addAIPlayerResponse', normalized.data, 200, null);
         })
         .catch(error =>
         {
            console.error('Add AI player request error:', error);
            const status = event.signal?.aborted ? 499 : 400;
            const errorBody = error instanceof ApiError ? error.body : {message: error.message || error};
            response = event.prepareResponse('system:addAIPlayerResponse', null, status, errorBody);
            correlationId = error?.correlationId || null;
         })
         .finally(() =>
         {
            this.applyCorrelationId(response, correlationId);
            eventBus.emit('system:addAIPlayerResponse', response);
         });
   }

   dispose()
   {
      this.eventRegister.unregisterEventHandlers();
   }
}
