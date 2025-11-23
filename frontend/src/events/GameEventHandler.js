/**
 * Game Event Handler - Manages game-level events and context
 * Handles game loading, rendering, and other game-specific events
 */
import { eventBus } from '../eventBus.js';
import { getHeaders, getHeadersForGet } from '../utils/apiHeaders.js';
import { webSocketManager } from '../services/WebSocketManager.js';
import { gameStatePoller } from '../services/GameStatePoller.js';

export class GameEventHandler {
  constructor() {
    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for game events
   */
  setupEventListeners() {
    // Listen for game load events
    eventBus.on('system:gameLoad', this.handleGameLoad.bind(this));
    
    // Listen for game render events
    eventBus.on('game:render', this.handleGameRender.bind(this));
    
    // Listen for new game events as requested
    eventBus.on('game:createGame', this.handleCreateGame.bind(this));
    eventBus.on('game:addPlayer', this.handleAddPlayer.bind(this));
    eventBus.on('game:loadGame', this.handleLoadGame.bind(this));
    eventBus.on('game:generateMap', this.handleGenerateMap.bind(this));
    eventBus.on('game:placePlayers', this.handlePlacePlayers.bind(this));
    eventBus.on('game:startGame', this.handleStartGame.bind(this));
  }

  /**
   * Handle game load event
   * @param {Object} context - Current system context
   * @param {string} gameId - Game ID to load
   */
  handleGameLoad(context, gameId) {
    console.log('🎮 GameEventHandler:(1) Processing game load for game:', gameId);
    console.log('🎮 GameEventHandler: Context:', context);
    
    // Set game in context via event bus
    eventBus.setGameId(gameId);
    
    // Emit game ready event
    eventBus.emit('system:gameReady', eventBus.getContext());
  }

  /**
   * Handle game render event
   * @param {Object} context - Current system context
   * @param {Object} gameData - Game data to render
   */
  handleGameRender(context, gameData) {
    console.log('🎨 GameEventHandler: Rendering game:', gameData);
    console.log('🎨 GameEventHandler: Context:', context);
    
    // TODO: Implement game rendering logic
    // This will handle the actual game state rendering
  }

  /**
   * Handle create game event
   * Can be used for:
   * 1. Creating a new game (requires ownerId, seed, mapSize, etc.)
   * 2. Creating game world for existing game (requires only gameId - generates map and places players)
   * @param {Object} context - Current system context
   * @param {Object} gameData - Game data to create or gameId for existing game
   */
  async handleCreateGame(context, gameData) {
    console.log('🎮 GameEventHandler: Creating game:', gameData);
    console.log('🎮 GameEventHandler: Context:', context);
    
    try {
      // Check if this is for an existing game (just gameId provided) or a new game
      if (gameData.gameId && !gameData.ownerId) {
        // This is for an existing game - generate map and place players
        return await this.createGameWorld(gameData.gameId);
      }
      
      // Otherwise, create a new game record
      // Validate required parameters
      const { ownerId, seed, mapSize, densityMin, densityMax, title, description, status } = gameData;
      
      if (!ownerId || !seed || !mapSize || densityMin === undefined || densityMax === undefined || !title || !description || !status) {
        const error = 'Missing required parameters: ownerId, seed, mapSize, densityMin, densityMax, title, description, status';
        console.error('🎮 GameEventHandler: Validation error:', error);
        
        // Emit error event
        eventBus.emit('game:gameCreated', { 
          success: false, 
          error: 'validation_error',
          message: error 
        });
        return;
      }
      
      // Call the backend API to create the game
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ownerId,
          seed,
          mapSize,
          densityMin,
          densityMax,
          title,
          description,
          status,
          params: gameData.params
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('🎮 GameEventHandler: API error:', errorData);
        
        // Emit error event with standardized format
        eventBus.emit('game:gameCreated', { 
          success: false, 
          error: 'api_error',
          message: errorData.error || 'Failed to create game',
          details: errorData.details
        });
        return;
      }
      
      const result = await response.json();
      console.log('🎮 GameEventHandler: Game created successfully:', result);
      
      // Emit success event with standardized format
      eventBus.emit('game:gameCreated', {
        success: true,
        details: {
          eventType: 'game:gameCreated',
          gameId: result.gameId,
          status: status
        }
      });
      
    } catch (error) {
      console.error('🎮 GameEventHandler: Unexpected error creating game:', error);
      
      // Emit error event with standardized format
      eventBus.emit('game:gameCreated', { 
        success: false, 
        error: 'unexpected_error',
        message: error.message || 'Unexpected error occurred'
      });
    }
  }

  /**
   * Create game world for an existing game (generate map and place players)
   * @param {string} gameId - Game ID
   */
  async createGameWorld(gameId) {
    console.log('🎮 GameEventHandler: Creating game world for existing game:', gameId);
    
    try {
      if (!gameId) {
        eventBus.emit('game:gameCreated', { 
          success: false, 
          error: 'validation_error',
          message: 'Game ID is required'
        });
        return;
      }

      // Step 1: Generate map
      console.log('🎮 GameEventHandler: Step 1 - Generating map...');
      const mapResponse = await fetch(`/api/games/${gameId}/generate-map`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({})
      });

      if (!mapResponse.ok) {
        const errorData = await mapResponse.json();
        console.error('🎮 GameEventHandler: Map generation failed:', errorData);
        eventBus.emit('game:gameCreated', { 
          success: false, 
          error: 'api_error',
          message: errorData.error || 'Failed to generate map',
          details: errorData.details
        });
        return;
      }

      const mapResult = await mapResponse.json();
      console.log('🎮 GameEventHandler: Map generated successfully:', mapResult);

      // Step 2: Place players
      console.log('🎮 GameEventHandler: Step 2 - Placing players...');
      const placeResponse = await fetch(`/api/games/${gameId}/place-players`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({})
      });

      if (!placeResponse.ok) {
        const errorData = await placeResponse.json();
        console.error('🎮 GameEventHandler: Player placement failed:', errorData);
        eventBus.emit('game:gameCreated', { 
          success: false, 
          error: 'api_error',
          message: errorData.error || 'Failed to place players',
          details: errorData.details
        });
        return;
      }

      const placeResult = await placeResponse.json();
      console.log('🎮 GameEventHandler: Players placed successfully:', placeResult);

      // Emit success event
      eventBus.emit('game:gameCreated', {
        success: true,
        details: {
          eventType: 'game:gameCreated',
          gameId: gameId,
          starsCount: mapResult.starsCount,
          wormholesCount: mapResult.wormholesCount,
          playersPlaced: placeResult.playersPlaced || 0
        }
      });

    } catch (error) {
      console.error('🎮 GameEventHandler: Unexpected error creating game world:', error);
      eventBus.emit('game:gameCreated', { 
        success: false, 
        error: 'unexpected_error',
        message: error.message || 'Unexpected error occurred'
      });
    }
  }

  /**
   * Handle add player event
   * @param {Object} context - Current system context
   * @param {Object} playerData - Player data to add
   */
  async handleAddPlayer(context, playerData) {
    console.log('🎮 GameEventHandler: Adding player:', playerData);
    console.log('🎮 GameEventHandler: Context:', context);
    
    try {
      // Validate required parameters
      const { gameId, userId, name, color_hex, country_name, meta } = playerData;
      
      if (!gameId || !name || !color_hex) {
        const error = 'Missing required parameters: gameId, name, color_hex';
        console.error('🎮 GameEventHandler: Validation error:', error);
        
        // Emit error event with standardized format
        eventBus.emit('game:playerAdded', { 
          success: false, 
          error: 'validation_error',
          message: error 
        });
        return;
      }
      
      // Parse meta if it's a string (from DevEventHandler)
      let metaData = meta || {};
      if (typeof meta === 'string') {
        try {
          metaData = JSON.parse(meta);
        } catch (e) {
          console.warn('🎮 GameEventHandler: Failed to parse meta, using empty object:', e);
          metaData = {};
        }
      }
      
      // Call the backend API to add the player
      const response = await fetch('/api/games/players', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          gameId,
          userId,
          name,
          colorHex: color_hex,
          countryName: country_name,
          meta: metaData
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('🎮 GameEventHandler: API error:', errorData);
        
        // Emit error event with standardized format
        eventBus.emit('game:playerAdded', { 
          success: false, 
          error: 'api_error',
          message: errorData.error || 'Failed to add player',
          details: errorData.error || 'Failed to add player'
        });
        return;
      }
      
      const result = await response.json();
      console.log('🎮 GameEventHandler: Player added successfully:', result);
      
      // Emit success event with standardized format
      eventBus.emit('game:playerAdded', {
        success: true,
        details: {
          eventType: 'game:playerAdded',
          gameId: gameId,
          playerId: result.id,
          playerName: name
        }
      });
      
    } catch (error) {
      console.error('🎮 GameEventHandler: Unexpected error adding player:', error);
      
      // Emit error event with standardized format
      eventBus.emit('game:playerAdded', { 
        success: false, 
        error: 'unexpected_error',
        message: error.message || 'Unexpected error occurred'
      });
    }
  }

  /**
   * Handle load game event
   * @param {Object} context - Current system context
   * @param {string} gameId - Game ID to load
   */
  handleLoadGame(context, gameId) {
    console.log('🎮 GameEventHandler:(2) Loading game:', gameId);
    console.log('🎮 GameEventHandler: Context:', context);
    
    // TODO: Implement game loading logic
    // For now, just log the event as requested
  }

  /**
   * Handle generate map event
   * @param {Object} context - Current system context
   * @param {Object} mapData - Map generation data
   */
  async handleGenerateMap(context, mapData) {
    console.log('🎮 GameEventHandler: Generating map:', mapData);
    console.log('🎮 GameEventHandler: Context:', context);
    
    try {
      // Validate required parameters
      const { gameId } = mapData;
      
      if (!gameId) {
        const error = 'Missing required parameter: gameId';
        console.error('🎮 GameEventHandler: Validation error:', error);
        
        // Emit error event with standardized format
        eventBus.emit('game:mapGenerated', { 
          success: false, 
          error: 'validation_error',
          message: error 
        });
        return;
      }
      
      // Call the backend API to generate the map (only need gameId)
      const response = await fetch(`/api/games/${gameId}/generate-map`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('🎮 GameEventHandler: API error:', errorData);
        
        // Emit error event with standardized format
        eventBus.emit('game:mapGenerated', { 
          success: false, 
          error: 'api_error',
          message: errorData.error || 'Failed to generate map',
          details: errorData.details
        });
        return;
      }
      
      const result = await response.json();
      console.log('🎮 GameEventHandler: Map generated successfully:', result);
      
      // Emit success event with standardized format
      eventBus.emit('game:mapGenerated', {
        success: true,
        details: {
          eventType: 'game:mapGenerated',
          gameId: result.gameId,
          starsCount: result.starsCount,
          wormholesCount: result.wormholesCount
        }
      });
      
    } catch (error) {
      console.error('🎮 GameEventHandler: Unexpected error generating map:', error);
      
      // Emit error event with standardized format
      eventBus.emit('game:mapGenerated', { 
        success: false, 
        error: 'unexpected_error',
        message: error.message || 'Unexpected error occurred'
      });
    }
  }

  /**
   * Handle place players event
   * @param {Object} context - Current system context
   * @param {Object} data - Event data containing gameId
   */
  async handlePlacePlayers(context, data) {
    try {
      console.log('🎮 GameEventHandler: Placing players with data:', data);
      
      const { gameId } = data;
      
      if (!gameId) {
        console.error('🎮 GameEventHandler: Missing gameId in placePlayers data');
        
        // Emit error event with standardized format
        eventBus.emit('game:playersPlaced', { 
          success: false, 
          error: 'missing_gameId',
          message: 'Game ID is required for placing players'
        });
        return;
      }
      
      // Call the backend API to place players
      const response = await fetch(`/api/games/${gameId}/place-players`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('🎮 GameEventHandler: API error placing players:', errorData);
        
        // Emit error event with standardized format
        eventBus.emit('game:playersPlaced', { 
          success: false, 
          error: 'api_error',
          message: errorData.error || 'Failed to place players'
        });
        return;
      }
      
      const result = await response.json();
      console.log('🎮 GameEventHandler: Players placed successfully:', result);
      
      // Emit success event with standardized format
      eventBus.emit('game:playersPlaced', { 
        success: true, 
        details: {
          eventType: 'game:playersPlaced',
          gameId: gameId,
          playersPlaced: result.playersPlaced || 0
        }
      });
      
    } catch (error) {
      console.error('🎮 GameEventHandler: Unexpected error placing players:', error);
      
      // Emit error event with standardized format
      eventBus.emit('game:playersPlaced', { 
        success: false, 
        error: 'unexpected_error',
        message: error.message || 'Unexpected error occurred'
      });
    }
  }

  /**
   * Get the current turn for a game, creating turn 1 if no open turn exists
   * @param {string} gameId - Game ID
   * @returns {Promise<Object>} Current turn object
   */
  async getCurrentTurn(gameId) {
    console.log('🎮 GameEventHandler: Getting current turn for game:', gameId);
    
    try {
      // First, try to get the open turn
      const openTurnResponse = await fetch(`/api/games/${gameId}/turn/open`, {
        headers: getHeadersForGet()
      });
      
      if (openTurnResponse.ok) {
        const openTurnData = await openTurnResponse.json();
        if (openTurnData.success && openTurnData.turn) {
          console.log('🎮 GameEventHandler: Found open turn:', openTurnData.turn);
          return openTurnData.turn;
        }
      }
      
      // If no open turn exists, create turn 1
      console.log('🎮 GameEventHandler: No open turn found, creating turn 1');
      const createTurnResponse = await fetch(`/api/games/${gameId}/turn`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          number: 1
        })
      });
      
      if (!createTurnResponse.ok) {
        const errorData = await createTurnResponse.json();
        throw new Error(errorData.error || 'Failed to create turn 1');
      }
      
      const createTurnData = await createTurnResponse.json();
      if (createTurnData.success && createTurnData.turn) {
        console.log('🎮 GameEventHandler: Created turn 1:', createTurnData.turn);
        return createTurnData.turn;
      } else {
        throw new Error('Failed to create turn 1 - invalid response');
      }
      
    } catch (error) {
      console.error('🎮 GameEventHandler: Error getting/creating current turn:', error);
      throw error;
    }
  }

  /**
   * Handle start game event - loads complete game state and emits gameLoaded event
   * @param {Object} context - Current system context
   * @param {Object} data - Event data containing gameId
   */
  async handleStartGame(context, data) {
    console.log('🎮 GameEventHandler: Starting game with data:', data);
    console.log('🎮 GameEventHandler: Context:', context);
    
    try {
      const { gameId } = data;
      
      if (!gameId) {
        console.error('🎮 GameEventHandler: Missing gameId in startGame data');
        
        // Emit error event
        eventBus.emit('game:gameLoaded', { 
          success: false, 
          error: 'missing_gameId',
          message: 'Game ID is required to start game'
        });
        return;
      }
      
      // Load complete game state from backend
      const response = await fetch(`/api/games/${gameId}/state`, {
        method: 'GET',
        headers: getHeadersForGet()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('🎮 GameEventHandler: API error loading game state:', errorData);
        
        // Emit error event
        eventBus.emit('game:gameLoaded', { 
          success: false, 
          error: 'api_error',
          message: errorData.error || 'Failed to load game state'
        });
        return;
      }
      
      const gameData = await response.json();
      console.log('🎮 GameEventHandler: Game state loaded successfully:', gameData);
      
      // Set game ID on event bus
      eventBus.setGameId(gameId);
      
      // Set player ID from the game state (this is the player_id for the current user in this game)
      if (gameData.currentPlayerId) {
        eventBus.setPlayerId(gameData.currentPlayerId);
        console.log('🎮 GameEventHandler: Set player ID:', gameData.currentPlayerId);
      } else {
        console.warn('🎮 GameEventHandler: No currentPlayerId in game state - user may not be a player in this game');
        eventBus.setPlayerId(null);
      }
      
      // Get current turn for the game
      const currentTurn = await this.getCurrentTurn(gameId);
      
      // Join WebSocket game room if WebSocket is connected
      if (webSocketManager.isWebSocketConnected() && gameData.currentPlayerId) {
        webSocketManager.joinGame(gameId, gameData.currentPlayerId);
      } else {
        // If WebSocket not connected, start polling as fallback
        if (currentTurn) {
          gameStatePoller.startPolling(gameId, currentTurn.number);
        }
      }
      
      // Update poller with current turn number if polling is active
      if (currentTurn && gameStatePoller.isPolling) {
        gameStatePoller.updateTurnNumber(currentTurn.number);
      }
      
      // Emit success event with complete game data including current turn
      console.log(eventBus.listeners)
      eventBus.emit('game:gameLoaded', {
        success: true,
        details: {
          eventType: 'game:gameLoaded',
          gameId: gameId,
          gameData: gameData,
          currentTurn: currentTurn
        }
      });
      
    } catch (error) {
      console.error('🎮 GameEventHandler: Unexpected error starting game:', error);
      
      // Emit error event
      eventBus.emit('game:gameLoaded', { 
        success: false, 
        error: 'unexpected_error',
        message: error.message || 'Unexpected error occurred'
      });
    }
  }

  /**
   * Clean up event listeners
   */
  dispose() {
    eventBus.off('system:gameLoad', this.handleGameLoad.bind(this));
    eventBus.off('game:render', this.handleGameRender.bind(this));
    eventBus.off('game:createGame', this.handleCreateGame.bind(this));
    eventBus.off('game:addPlayer', this.handleAddPlayer.bind(this));
    eventBus.off('game:loadGame', this.handleLoadGame.bind(this));
    eventBus.off('game:generateMap', this.handleGenerateMap.bind(this));
    eventBus.off('game:placePlayers', this.handlePlacePlayers.bind(this));
    eventBus.off('game:startGame', this.handleStartGame.bind(this));
  }
}
