/**
 * Game Event Handler - Manages game-level events and context
 * Handles game loading, rendering, and other game-specific events
 */
import { eventBus } from '../eventBus.js';
import { RB, ApiError } from '../utils/RequestBuilder.js';
import { ApiRequest, ApiResponse } from './Events.js';

export class GameEventHandler
{
   constructor()
   {
   }

   /**
    * Handle create game event
    * Can be used for:
    * 1. Creating a new game (requires ownerId, seed, mapSize, etc.)
    * 2. Creating game world for existing game (requires only gameId - generates map and places players)
    * @param {Object} context - Current system context
    * @param {Object} gameData - Game data to create or gameId for existing game
    */
   async handleCreateGame(context, gameData)
   {
      console.log('🎮 GameEventHandler: Creating game:', gameData);
      console.log('🎮 GameEventHandler: Context:', context);

      try
      {
         // Check if this is for an existing game (just gameId provided) or a new game
         if (gameData.gameId && !gameData.ownerId)
         {
            // This is for an existing game - generate map and place players
            return await this.createGameWorld(gameData.gameId);
         }

         // Otherwise, create a new game record
         // Validate required parameters
         const { ownerId, seed, mapSize, densityMin, densityMax, title, description, status } = gameData;

         if (!ownerId || !seed || !mapSize || densityMin === undefined || densityMax === undefined || !title || !description || !status)
         {
            const error = 'Missing required parameters: ownerId, seed, mapSize, densityMin, densityMax, title, description, status';
            console.error('🎮 GameEventHandler: Validation error:', error);

            // Emit error event
            eventBus.emit('game:gameCreated',
            {
               success: false,
               error: 'validation_error',
               message: error
            });
            return;
         }

         // Call the backend API to create the game
         const result = await RB.fetchPost('/api/games', {ownerId, seed, mapSize, densityMin, densityMax, title, description, status, params: gameData.params});
         console.log('🎮 GameEventHandler: Game created successfully:', result);

         // Emit success event with standardized format
         eventBus.emit('game:gameCreated',
         {
            success: true,
            details:
            {
               eventType: 'game:gameCreated',
               gameId: result.gameId,
               status: status
            }
         });

      }
      catch (error)
      {
         console.error('🎮 GameEventHandler: Error creating game:', error);

         // Extract error data from ApiError if available
         const errorData = error instanceof ApiError ? (error.body || {error: error.message}) : {error: error.message};

         // Emit error event with standardized format
         eventBus.emit('game:gameCreated', {
            success: false,
            error: 'api_error',
            message: errorData.error || error.message || 'Failed to create game',
            details: errorData.details
         });
      }
   }

   /**
    * Create game world for an existing game (generate map and place players)
    * @param {string} gameId - Game ID
    */
   async createGameWorld(gameId)
   {
      console.log('🎮 GameEventHandler: Creating game world for existing game:', gameId);

      try
      {
         if (!gameId)
         {
            eventBus.emit('game:gameCreated',
            {
               success: false,
               error: 'validation_error',
               message: 'Game ID is required'
            });
            return;
         }

         // Step 1: Generate map
         console.log('🎮 GameEventHandler: Step 1 - Generating map...');
         const mapResult = await RB.fetchPost(`/api/games/${gameId}/generate-map`, {});
         console.log('🎮 GameEventHandler: Map generated successfully:', mapResult);

         // Step 2: Place players
         console.log('🎮 GameEventHandler: Step 2 - Placing players...');
         const placeResult = await RB.fetchPost(`/api/games/${gameId}/place-players`, {});
         console.log('🎮 GameEventHandler: Players placed successfully:', placeResult);

         // Emit success event
         eventBus.emit('game:gameCreated',
         {
            success: true,
            details:
            {
               eventType: 'game:gameCreated',
               gameId: gameId,
               starsCount: mapResult.starsCount,
               wormholesCount: mapResult.wormholesCount,
               playersPlaced: placeResult.playersPlaced || 0
            }
         });

      }
      catch (error)
      {
         console.error('🎮 GameEventHandler: Error creating game world:', error);
         const errorData = error instanceof ApiError ? (error.body || { error: error.message }) : { error: error.message };
         eventBus.emit('game:gameCreated', { success: false, error: 'api_error', message: errorData.error || error.message || 'Failed to create game world', details: errorData.details });
      }
   }

   /**
    * Handle add player event
    * @param {Object} context - Current system context
    * @param {Object} playerData - Player data to add
    */
   async handleAddPlayer(context, playerData)
   {
      console.log('🎮 GameEventHandler: Adding player:', playerData);
      console.log('🎮 GameEventHandler: Context:', context);

      try
      {
         // Validate required parameters
         const { gameId, userId, name, color_hex, country_name, meta } = playerData;

         if (!gameId || !name || !color_hex)
         {
            const error = 'Missing required parameters: gameId, name, color_hex';
            console.error('🎮 GameEventHandler: Validation error:', error);

            // Emit error event with standardized format
            eventBus.emit('game:playerAdded',
            {
               success: false,
               error: 'validation_error',
               message: error
            });
            return;
         }

         // Parse meta if it's a string (from DevEventHandler)
         let metaData = meta || {};
         if (typeof meta === 'string')
         {
            try
            {
               metaData = JSON.parse(meta);
            }
            catch (e)
            {
               console.warn('🎮 GameEventHandler: Failed to parse meta, using empty object:', e);
               metaData = {};
            }
         }

         // Call the backend API to add the player
         const result = await RB.fetchPost('/api/games/players', {gameId, userId, name, colorHex: color_hex, countryName: country_name, meta: metaData});
         console.log('🎮 GameEventHandler: Player added successfully:', result);

         // Emit success event with standardized format
         eventBus.emit('game:playerAdded',
         {
            success: true,
            details:
            {
               eventType: 'game:playerAdded',
               gameId: gameId,
               playerId: result.id,
               playerName: name
            }
         });

      }
      catch (error)
      {
         console.error('🎮 GameEventHandler: Error adding player:', error);
         const errorData = error instanceof ApiError ? (error.body || { error: error.message }) : { error: error.message };

         // Emit error event with standardized format
         eventBus.emit('game:playerAdded',
         {
            success: false,
            error: 'api_error',
            message: errorData.error || error.message || 'Failed to add player',
            details: errorData.details
         });
      }
   }

   /**
    * Handle request initial load event - loads complete game state and emits gameLoaded event
    * @param {Object} context - Current system context
    * @param {Object} event - Event data containing gameId
    */
   requestInitialLoad(event)
   {
      console.log('🎮 GameEventHandler: Loading game with data:', event);

      const gameId = event?.data?.gameId;

      if (!gameId)
      {
         console.error('🎮 GameEventHandler: Missing gameId in loadGame data');

         eventBus.emit('game:initialLoaded', event.prepareResponse('game:initialLoaded', null, 400, 'Missing game id'));
         return;
      }

      let response = null;

      // Load complete game state from backend
      RB.fetchGet(`/api/games/${gameId}/state`)
         .then(success =>
         {
            console.log('🎮 GameEventHandler: Game state loaded successfully:', success);
            response = event.prepareResponse('game:initialLoaded', success, 200, null);
         })
         .catch(error =>
         {
            console.error('🎮 GameEventHandler: Error loading game state:', error);
            response = event.prepareResponse('game:initialLoaded', null, 500, error);
         })
         .finally(() =>
         {
            eventBus.emit('game:initialLoaded', response);
         });
   }

   /**
    * Handle generate map event
    * @param {Object} context - Current system context
    * @param {Object} mapData - Map generation data
    */
   async handleGenerateMap(context, mapData)
   {
      console.log('🎮 GameEventHandler: Generating map:', mapData);
      console.log('🎮 GameEventHandler: Context:', context);

      try
      {
         // Validate required parameters
         const { gameId } = mapData;

         if (!gameId)
         {
            const error = 'Missing required parameter: gameId';
            console.error('🎮 GameEventHandler: Validation error:', error);

            // Emit error event with standardized format
            eventBus.emit('game:mapGenerated',
            {
               success: false,
               error: 'validation_error',
               message: error
            });
            return;
         }

         // Call the backend API to generate the map (only need gameId)
         const result = await RB.fetchPost(`/api/games/${gameId}/generate-map`, {});
         console.log('🎮 GameEventHandler: Map generated successfully:', result);

         // Emit success event with standardized format
         eventBus.emit('game:mapGenerated',
         {
            success: true,
            details:
            {
               eventType: 'game:mapGenerated',
               gameId: result.gameId,
               starsCount: result.starsCount,
               wormholesCount: result.wormholesCount
            }
         });

      }
      catch (error)
      {
         console.error('🎮 GameEventHandler: Error generating map:', error);
         const errorData = error instanceof ApiError ? (error.body || {error: error.message}) : {error: error.message};
         // Emit error event with standardized format
         eventBus.emit('game:mapGenerated',
         {
            success: false,
            error: 'api_error',
            message: errorData.error || error.message || 'Failed to generate map',
            details: errorData.details
         });
      }
   }

   /**
    * Handle place players event
    * @param {Object} context - Current system context
    * @param {Object} data - Event data containing gameId
    */
   async handlePlacePlayers(context, data)
   {
      try
      {
         console.log('🎮 GameEventHandler: Placing players with data:', data);

         const gameId = data?.gameId;

         if (!gameId)
         {
            console.error('🎮 GameEventHandler: Missing gameId in placePlayers data');

            // Emit error event with standardized format
            eventBus.emit('game:playersPlaced',
            {
               success: false,
               error: 'missing_gameId',
               message: 'Game ID is required for placing players'
            });
            return;
         }

         // Call the backend API to place players
         const result = await RB.fetchPost(`/api/games/${gameId}/place-players`,
         {});
         console.log('🎮 GameEventHandler: Players placed successfully:', result);

         // Emit success event with standardized format
         eventBus.emit('game:playersPlaced',
         {
            success: true,
            details:
            {
               eventType: 'game:playersPlaced',
               gameId: gameId,
               playersPlaced: result.playersPlaced || 0
            }
         });

      }
      catch (error)
      {
         console.error('🎮 GameEventHandler: Error placing players:', error);
         const errorData = error instanceof ApiError ? (error.body || {error: error.message}) : {error: error.message};

         // Emit error event with standardized format
         eventBus.emit('game:playersPlaced',
         {
            success: false,
            error: 'api_error',
            message: errorData.error || error.message || 'Failed to place players',
            details: errorData.details
         });
      }
   }

   /**
    * Get the current turn for a game, creating turn 1 if no open turn exists
    * @param {string} gameId - Game ID
    * @returns {Promise<Object>} Current turn object
    */
   async getCurrentTurn(gameId)
   {
      console.log('🎮 GameEventHandler: Getting current turn for game:', gameId);

      try
      {
         // First, try to get the open turn
         try
         {
            const openTurnData = await RB.fetchGet(`/api/games/${gameId}/turn/open`);
            if (openTurnData.success && openTurnData.turn)
            {
               console.log('🎮 GameEventHandler: Found open turn:', openTurnData.turn);
               return openTurnData.turn;
            }
         }
         catch (error)
         {
            // 404 is acceptable - no open turn exists yet
            if (error instanceof ApiError && error.status === 404)
               console.log('🎮 GameEventHandler: No open turn found');
            else
               throw error;
         }

         // If no open turn exists, create turn 1
         console.log('🎮 GameEventHandler: No open turn found, creating turn 1');
         const createTurnData = await RB.fetchPost(`/api/games/${gameId}/turn`, {});

         if (createTurnData.success && createTurnData.turn)
         {
            console.log('🎮 GameEventHandler: Created turn 1:', createTurnData.turn);
            return createTurnData.turn;
         }
         else
            throw new Error('Failed to create turn 1 - invalid response');
      }
      catch (error)
      {
         console.error('🎮 GameEventHandler: Error getting/creating current turn:', error);
         throw error;
      }
   }

   /**
    * Handle start game event - starts the game after it has been loaded
    * @param {Object} context - Current system context
    * @param {Object} event - Event data containing gameId
    */
   async handleStartGame(event)
   {
      console.log('🎮 GameEventHandler: Starting game with data:', event);

      // Game should already be loaded at this point
      // This method can be used for any additional initialization needed to start the game
      const gameId = event?.gameId;

      if (!gameId)
      {
         console.error('🎮 GameEventHandler: Missing gameId in startGame data');
         return;
      }

      // Emit game start event for rendering/display
      eventBus.emit('game:start',
      {
         success: true,
         details:
         {
            eventType: 'game:start',
            gameId: gameId
         }
      });
   }
}
