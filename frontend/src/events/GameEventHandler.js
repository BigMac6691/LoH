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
          status
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('🎮 GameEventHandler: API error:', errorData);
        
        // Emit error event
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
      
      // Emit success event with game details
      eventBus.emit('game:gameCreated', {
        success: true,
        game: {
          id: result.gameId,
          title: title,
          status: status
        }
      });
      
    } catch (error) {
      console.error('🎮 GameEventHandler: Unexpected error creating game:', error);
      
      // Emit error event
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
  handleAddPlayer(context, playerData) {
    console.log('🎮 GameEventHandler: Adding player:', playerData);
    console.log('🎮 GameEventHandler: Context:', context);
    
    // TODO: Implement player addition logic
    // For now, just log the event as requested
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
   * Clean up event listeners
   */
  dispose() {
    eventBus.off('system:gameLoad', this.handleGameLoad.bind(this));
    eventBus.off('game:render', this.handleGameRender.bind(this));
    eventBus.off('game:createGame', this.handleCreateGame.bind(this));
    eventBus.off('game:addPlayer', this.handleAddPlayer.bind(this));
    eventBus.off('game:loadGame', this.handleLoadGame.bind(this));
  }
}
