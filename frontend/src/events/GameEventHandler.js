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
   * Clean up event listeners
   */
  dispose() {
    eventBus.off('system:gameLoad', this.handleGameLoad.bind(this));
    eventBus.off('game:render', this.handleGameRender.bind(this));
  }
}
