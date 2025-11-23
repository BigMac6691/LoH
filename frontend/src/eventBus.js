/**
 * Event Bus - Centralized event system for game communication
 * Handles custom events for startup flow and game state management
 */
export class EventBus {
  constructor() {
    this.listeners = new Map();
    this.context = {
      user: null,      // user_id (from JWT/auth)
      playerId: null,  // player_id (game-specific, from game_player.id)
      gameId: null
    };
  }

  /**
   * Add an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @param {Object} options - Options (once: boolean)
   */
  on(event, callback, options = {}) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event).push({
      callback,
      once: options.once || false
    });
  }

  /**
   * Add a one-time event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  once(event, callback) {
    this.on(event, callback, { once: true });
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    
    const listeners = this.listeners.get(event);
    const index = listeners.findIndex(listener => listener.callback === callback);
    
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data = null) {
    if (!this.listeners.has(event)) return;
    
    const listeners = this.listeners.get(event);
    const toRemove = [];
    
    listeners.forEach((listener, index) => {
      try {
        listener.callback(this.context, data);
        
        if (listener.once) {
          toRemove.push(index);
        }
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
    
    // Remove one-time listeners
    toRemove.reverse().forEach(index => {
      listeners.splice(index, 1);
    });
  }

  /**
   * Clear all listeners for an event
   * @param {string} event - Event name (optional, clears all if not provided)
   */
  clear(event = null) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get listener count for an event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    return this.listeners.has(event) ? this.listeners.get(event).length : 0;
  }

  /**
   * Set current user in context
   * @param {Object} user - User data
   */
  setUser(user) {
    this.context.user = user;
    console.log('👤 EventBus: User context updated:', user);
  }

  /**
   * Set current game ID in context
   * @param {string} gameId - Game ID
   */
  setGameId(gameId) {
    this.context.gameId = gameId;
    console.log('🎯 EventBus: Game context updated:', gameId);
  }

  /**
   * Set current player ID in context (game-specific)
   * @param {string} playerId - Player ID (from game_player.id)
   */
  setPlayerId(playerId) {
    this.context.playerId = playerId;
    console.log('👤 EventBus: Player ID context updated:', playerId);
  }

  /**
   * Get current context
   * @returns {Object} Current context with user, playerId, and gameId
   */
  getContext() {
    return { ...this.context };
  }
}

// Create global event bus instance
export const eventBus = new EventBus();

// Make available globally for debugging
window.eventBus = eventBus; 

// Add star-related events to the global event bus
export const STAR_EVENTS = {
  HOVER: 'star:hover',
  UNHOVER: 'star:unhover',
  CLICK: 'star:click'
}; 