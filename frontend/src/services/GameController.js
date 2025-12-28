/**
 * GameController - Bridge between EventBus, GameSession, and GameEventHandler
 * 
 * Why GameController exists:
 * - Centralizes session lifecycle management (creates/disposes GameSession on game transitions)
 * - Provides single point for session validation before gameplay operations
 * - Separates session concerns from gameplay logic (GameEventHandler focuses on game logic)
 * - Acts as the guard layer that prevents stale async operations from executing
 * 
 * How it uses GameSession:
 * - Creates a new GameSession when a game is loaded (game:requestInitial or game:requestRefresh event)
 * - Disposes the previous GameSession when switching games
 * - Uses session guard methods (runIfValid, runAsync, isValid) to validate operations
 * - GameSession acts as a validation token, not an event handler itself
 * 
 * How it prevents stale async execution:
 * - All gameplay events are guarded by session validity checks
 * - When session is disposed, the sessionId changes, invalidating all pending operations
 * - Events arriving after disposal are ignored (session invalid check fails)
 * - Async callbacks that captured the old sessionId will fail validation and safely ignore results
 */
import { gameStateManager as GSM } from './GameStateManager';
import { webSocketManager } from './WebSocketManager';
import { ApiEvent, ApiRequest, ApiResponse } from '../events/Events.js';
import { EventRegister } from '../EventRegister.js';

export class GameController
{
   /**
    * Create a new GameController
    * @param {Object} eventBus - EventBus instance for listening to game events
    * @param {GameEventHandler} gameEventHandler - GameEventHandler instance for gameplay logic
    * @param {Class} GameSessionClass - GameSession class (not instance) for creating sessions
    */
   constructor(eventBus, gameEventHandler, GameSessionClass)
   {
      if (!eventBus)
         throw new Error('GameController: eventBus is required');
      
      if (!gameEventHandler)
         throw new Error('GameController: gameEventHandler is required');
      
      if (!GameSessionClass)
         throw new Error('GameController: GameSessionClass is required');

      this.eventBus = eventBus;
      this.gameEventHandler = gameEventHandler;
      this.GameSessionClass = GameSessionClass;
      
      /**
       * Current game session - null when no game is loaded
       * Owned and managed by GameController
       */
      this.currentSession = null;

      /**
       * Track bound handlers for cleanup
       */
      this.eventRegister = new EventRegister();

      this.setupEventListeners();
   }

   /**
    * Set up event listeners for all game-related events
    */
   setupEventListeners()
   {
      this.eventRegister.registerEventHandler('game:requestInitial', this.handleRequestInitial.bind(this));
      this.eventRegister.registerEventHandler('game:initialLoaded', this.handleInitialLoaded.bind(this));
      this.eventRegister.registerEventHandler('game:initialApplied', this.handleInitialApplied.bind(this));
      this.eventRegister.registerEventHandler('game:requestRefresh', this.handleRequestRefresh.bind(this));
      this.eventRegister.registerEventHandler('game:refreshLoaded', this.handleRefreshLoaded.bind(this));
      this.eventRegister.registerEventHandler('game:refreshApplied', this.handleRefreshApplied.bind(this));

      //////////////////////////////////////////////
      // Generic handler for all other game:* events
      //////////////////////////////////////////////

      // this.boundHandlers.set('game:render', this.handleGameEvent.bind(this));
      // this.eventBus.on('game:render', this.boundHandlers.get('game:render'));

      // this.boundHandlers.set('game:createGame', this.handleGameEvent.bind(this));
      // this.eventBus.on('game:createGame', this.boundHandlers.get('game:createGame'));

      // this.boundHandlers.set('game:addPlayer', this.handleGameEvent.bind(this));
      // this.eventBus.on('game:addPlayer', this.boundHandlers.get('game:addPlayer'));

      // this.boundHandlers.set('game:generateMap', this.handleGameEvent.bind(this));
      // this.eventBus.on('game:generateMap', this.boundHandlers.get('game:generateMap'));

      // this.boundHandlers.set('game:placePlayers', this.handleGameEvent.bind(this));
      // this.eventBus.on('game:placePlayers', this.boundHandlers.get('game:placePlayers'));

      // this.boundHandlers.set('game:startGame', this.handleGameEvent.bind(this));
      // this.eventBus.on('game:startGame', this.boundHandlers.get('game:startGame'));
   }

   /**
    * Handle game:requestInitial event - creates new session and forwards to GameEventHandler
    * @param {ApiRequest} event - Load game event with gameId in data
    */
   handleRequestInitial(event)
   {
      console.log('🎮 GameController: Handling request initial load event:', event);

      // Dispose existing session if any (switching games)
      if (this.currentSession)
      {
         this.currentSession.dispose();
         this.currentSession = null;
      }

      // Extract gameId from event
      const gameId = event?.data?.gameId;
      if (!gameId)
         return; // Invalid event, no gameId

      // Create new session for this game
      this.currentSession = new this.GameSessionClass(gameId);

      // Forward to GameEventHandler (it handles the actual loading logic)
      // Session is created first so any async operations in handleLoadGame can use it
      this.gameEventHandler.requestInitialLoad(event);
   }

   /**
    * Handle game:initialLoaded event - validates session after game is loaded
    * This event is emitted BY GameEventHandler after loading completes
    * @param {ApiResponse} event - Initial loaded response event
    */
   handleInitialLoaded(event)
   {
      console.log('🎮 GameController: Handling initial loaded event:', event);
      // Validate session exists and is still valid
      // If session was disposed during loading, ignore the result
      if (!this.currentSession || !this.currentSession.isValid())
         return; // Session invalid, ignore initial loaded game data

      // Session is valid - initial loaded successfully
      // No forwarding needed - this is a result event, not a request
      // Other components (GameStateManager, GameView) will handle this event
      GSM.applyInitial(event);
   }

   handleInitialApplied(event)
   {
      console.log('🎮 GameController: Handling initial applied event:', event);
      // Validate session exists and is still valid
      // If session was disposed during initial application, ignore the result
      if (!this.currentSession || !this.currentSession.isValid())
         return; // Session invalid, ignore initial applied game data

      // Session is valid - initial applied successfully
      // No forwarding needed - this is a result event, not a request
      // Other components (GameStateManager, GameView) will handle this event
      this.eventBus.emit('game:initialReady', event);
      this.eventBus.emit('ui:showScreen', new ApiEvent('ui:showScreen', {targetScreen: 'game'}));
   }

   handleRequestRefresh(event)
   {
      console.log('🎮 GameController: Handling request refresh event:', event);
   }

   handleRefreshLoaded(event)
   {
      console.log('🎮 GameController: Handling refresh loaded event:', event);
   
   }

   handleRefreshApplied(event)
   {
      console.log('🎮 GameController: Handling refresh applied event:', event);
      // Validate session exists and is still valid
      // If session was disposed during refresh application, ignore the result
      if (!this.currentSession || !this.currentSession.isValid())
         return; // Session invalid, ignore refresh loaded game data

      // Session is valid - refresh loaded successfully
      // No forwarding needed - this is a result event, not a request
      // Other components (GameStateManager, GameView) will handle this event
      this.eventBus.emit('game:refreshReady', event);
   }

   /**
    * Generic handler for other game:* events
    * Routes events through session guard before forwarding to GameEventHandler
    * @param {ApiEvent|ApiRequest} event - Game event to handle
    */
   handleGameEvent(event)
   {
      console.log('🎮 GameController: Handling game event:', event);
      // Guard: Check session exists and is valid
      if (!this.currentSession || !this.currentSession.isValid())
         return; // No active session or session disposed, ignore event

      // Route event type to appropriate GameEventHandler method
      const eventType = event?.type;
      if (!eventType)
         return;

      // Map event types to handler methods
      // Note: Some handlers take (context, data), others take (event)
      // We extract event.data for handlers that expect data, or pass event directly
      // Also track which handlers are async vs sync
      const handlerMap = 
      {
        'game:gameReady': 
        {
           handler: () => 
           {
              // Join WebSocket game room if connected and we have a session
              if (this.currentSession && webSocketManager.isWebSocketConnected())
              {
                 const gameId = this.currentSession.getGameId();
                 const playerId = GSM.currentPlayerId;
                 if (gameId && playerId)
                    webSocketManager.send('game:join', {gameId, playerId});
              }

            //   this.gameEventHandler.handleGameReady(null, event?.data || event);
              this.eventBus.emit('ui:showScreen', new ApiEvent('ui:showScreen', {targetScreen: 'game'}));
           },
           async: false
        },


         'game:render': 
         {
            handler: () => this.gameEventHandler.handleGameRender(null, event?.data || event),
            async: false
         },
         'game:createGame': 
         {
            handler: () => this.gameEventHandler.handleCreateGame(null, event?.data || event),
            async: true
         },
         'game:addPlayer': 
         {
            handler: () => this.gameEventHandler.handleAddPlayer(null, event?.data || event),
            async: true
         },
         'game:generateMap': 
         {
            handler: () => this.gameEventHandler.handleGenerateMap(null, event?.data || event),
            async: true
         },
         'game:placePlayers': 
         {
            handler: () => this.gameEventHandler.handlePlacePlayers(null, event?.data || event),
            async: true
         },
         'game:startGame': 
         {
            handler: () => this.gameEventHandler.handleStartGame(event),
            async: true
         }
      };

      const handlerInfo = handlerMap[eventType];
      if (!handlerInfo)
      {
         console.error('🎮 GameController: Unknown event type:', eventType);
         return;
      }

      // Execute handler with session guard
      // Use runIfValid for synchronous handlers, runAsync for async handlers
      // The session guard ensures the session is still valid when operations complete
      if (handlerInfo.async)
      {
         this.currentSession.runAsync(async () =>
         {
            await handlerInfo.handler();
         }).catch(error =>
         {
            // Session was disposed during async operation - this is expected and safe to ignore
            if (error.message && error.message.includes('Session was disposed'))
               return; // Silently ignore - session was disposed, operation cancelled
            
            // Re-throw other errors
            throw error;
         });
      }
      else // Synchronous handler - use runIfValid
         this.currentSession.runIfValid(() => { handlerInfo.handler(); });
   }

   /**
    * Get the current game session (for external access if needed)
    * @returns {GameSession|null} Current session or null if no game loaded
    */
   getCurrentSession()
   {
      return this.currentSession;
   }

   /**
    * Dispose the controller - clean up session and event listeners
    */
   dispose()
   {
      // Dispose current session if any
      if (this.currentSession)
      {
         this.currentSession.dispose();
         this.currentSession = null;
      }

      // Remove all event listeners0
      this.eventRegister.unregisterEventHandlers();
      this.eventRegister = null;
   }
}

