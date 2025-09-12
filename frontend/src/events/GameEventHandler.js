/**
 * Game Event Handler - Manages game-level events and context
 * Handles game loading, rendering, and other game-specific events
 */
import { eventBus } from '../eventBus.js';

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
    console.log('🎮 GameEventHandler: Processing game load for game:', gameId);
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
   * @param {Object} context - Current system context
   * @param {Object} gameData - Game data to create
   */
  async handleCreateGame(context, gameData) {
    console.log('🎮 GameEventHandler: Creating game:', gameData);
    console.log('🎮 GameEventHandler: Context:', context);
    
    try {
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
        headers: {
          'Content-Type': 'application/json',
        },
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
   * Handle add player event
   * @param {Object} context - Current system context
   * @param {Object} playerData - Player data to add
   */
  async handleAddPlayer(context, playerData) {
    console.log('🎮 GameEventHandler: Adding player:', playerData);
    console.log('🎮 GameEventHandler: Context:', context);
    
    try {
      // Validate required parameters
      const { gameId, userId, name, color_hex, country_name } = playerData;
      
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
      
      // Call the backend API to add the player
      const response = await fetch('/api/games/players', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId,
          userId,
          name,
          colorHex: color_hex,
          countryName: country_name
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
    console.log('🎮 GameEventHandler: Loading game:', gameId);
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
        headers: {
          'Content-Type': 'application/json',
        },
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
        headers: {
          'Content-Type': 'application/json',
        },
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
        headers: {
          'Content-Type': 'application/json',
        }
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
      
      // Set user ID to the first player in the list
      if (gameData.players && gameData.players.length > 0) {
        const firstPlayer = gameData.players[0];
        eventBus.setUser(firstPlayer.user_id);
        console.log('🎮 GameEventHandler: Set context - GameId:', gameId, 'UserId:', firstPlayer.user_id);
      } else {
        console.warn('🎮 GameEventHandler: No players found in game data');
      }
      
      // Emit success event with complete game data
      eventBus.emit('game:gameLoaded', {
        success: true,
        details: {
          eventType: 'game:gameLoaded',
          gameId: gameId,
          gameData: gameData
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
