/**
 * BaseAI - Abstract base class for all AI implementations
 * All AI implementations must extend this class and implement the takeTurn method
 */

export class BaseAI {
  /**
   * Constructor for BaseAI
   * @param {string} gameId - The game ID
   * @param {string} playerId - The player ID (AI is controlling this player)
   */
  constructor(gameId, playerId) {
    if (this.constructor === BaseAI) {
      throw new Error('BaseAI is abstract and cannot be instantiated directly');
    }
    
    this.gameId = gameId;
    this.playerId = playerId;
    this.name = this.constructor.name;
  }

  /**
   * Take a turn - must be implemented by subclasses
   * @param {Object} gameState - Filtered game state for this player
   * @param {Array} gameState.stars - Array of stars visible to the player
   * @param {Array} gameState.wormholes - Array of wormholes
   * @param {Array} gameState.starStates - Array of star states
   * @param {Array} gameState.ships - Array of ships visible to the player
   * @param {Array} gameState.players - Array of players
   * @returns {Promise<void>} - Issues orders via OrdersService
   * @abstract
   */
  async takeTurn(gameState) {
    throw new Error('takeTurn must be implemented by subclass');
  }

  /**
   * Log a message with AI prefix
   * @param {string} message - Message to log
   */
  log(message) {
    console.log(`🤖 ${this.name}[${this.playerId}]: ${message}`);
  }
}

