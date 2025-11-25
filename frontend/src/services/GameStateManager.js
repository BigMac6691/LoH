/**
 * GameStateManager - Singleton manager for game state
 * Centralizes all game data and handles game:gameLoaded and game:gameRefreshed events
 */
import { eventBus } from '../eventBus.js';

class GameStateManager {
  constructor() {
    // Fields that do NOT change between turns (only set on game:gameLoaded)
    this.gameId = null;
    this.stars = null;
    this.wormholes = null;
    this.players = null;
    this.gameInfo = null; // Includes map_size, seed, etc.

    // Fields that DO change between turns (updated on both events)
    this.turn = null;
    this.state = null; // star_state / starStates
    this.ships = null;
    this.orders = null;
    this.events = null;

    // Additional metadata
    this.currentPlayerId = null;

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for game state events
   */
  setupEventListeners() {
    eventBus.on('game:gameLoaded', this.handleGameLoaded.bind(this));
    eventBus.on('game:gameRefreshed', this.handleGameRefreshed.bind(this));
  }

  /**
   * Handle game:gameLoaded event - replaces all game state
   * @param {Object} context - Current system context
   * @param {Object} eventData - Event data containing complete game state
   */
  handleGameLoaded(context, eventData) {
    console.log('📦 GameStateManager: Received game:gameLoaded event');
    console.log('📦 GameStateManager: Event data:', eventData);
    console.log('📦 GameStateManager: Instance:', this);

    if (!eventData.success || !eventData.details) {
      console.warn('📦 GameStateManager: game:gameLoaded event was not successful or missing details');
      return;
    }

    const { gameId, gameData, currentTurn } = eventData.details;

    if (!gameData) {
      console.warn('📦 GameStateManager: gameData is missing from event details');
      return;
    }

    // Replace all fields
    this.gameId = gameId;
    this.stars = gameData.stars || null;
    this.wormholes = gameData.wormholes || null;
    this.players = gameData.players || null;
    this.gameInfo = gameData.gameInfo || null;

    // Replace refreshable fields
    this.turn = currentTurn || null;
    this.state = gameData.starStates || gameData.state || null;
    this.ships = gameData.ships || null;
    this.orders = gameData.orders || null;
    this.events = gameData.events || null;

    // Set current player ID if available
    this.currentPlayerId = gameData.currentPlayerId || null;

    console.log('📦 GameStateManager: Game state fully loaded');
    console.log('📦 GameStateManager: Game ID:', this.gameId);
    console.log('📦 GameStateManager: Stars:', this.stars?.length || 0);
    console.log('📦 GameStateManager: Wormholes:', this.wormholes?.length || 0);
    console.log('📦 GameStateManager: Players:', this.players?.length || 0);
    console.log('📦 GameStateManager: Current Turn:', this.turn?.number || null);
    console.log('📦 GameStateManager: Orders:', this.orders?.length || 0);
    console.log('📦 GameStateManager: Events:', this.events?.length || 0);
  }

  /**
   * Handle game:gameRefreshed event - only updates refreshable fields
   * @param {Object} context - Current system context
   * @param {Object} eventData - Event data containing refreshed game state
   */
  handleGameRefreshed(context, eventData) {
    console.log('📦 GameStateManager: Received game:gameRefreshed event');
    console.log('📦 GameStateManager: Event data:', eventData);
    console.log('📦 GameStateManager: Instance:', this);

    if (!eventData.success || !eventData.details) {
      console.warn('📦 GameStateManager: game:gameRefreshed event was not successful or missing details');
      return;
    }

    const { turn, state, ships, orders, events } = eventData.details;

    // Only update refreshable fields (do NOT update gameId, stars, wormholes, players)
    if (turn !== undefined) {
      this.turn = turn;
    }
    if (state !== undefined) {
      this.state = state;
    }
    if (ships !== undefined) {
      this.ships = ships;
    }
    if (orders !== undefined) {
      this.orders = orders;
    }
    if (events !== undefined) {
      this.events = events;
    }

    console.log('📦 GameStateManager: Game state refreshed');
    console.log('📦 GameStateManager: Current Turn:', this.turn?.number || null);
    console.log('📦 GameStateManager: State entries:', this.state?.length || 0);
    console.log('📦 GameStateManager: Ships:', this.ships?.length || 0);
    console.log('📦 GameStateManager: Orders:', this.orders?.length || 0);
    console.log('📦 GameStateManager: Events:', this.events?.length || 0);
  }

  /**
   * Get the current game ID
   * @returns {string|null} Game ID or null
   */
  getGameId() {
    return this.gameId;
  }

  /**
   * Get all stars
   * @returns {Array|null} Stars array or null
   */
  getStars() {
    return this.stars;
  }

  /**
   * Get all wormholes
   * @returns {Array|null} Wormholes array or null
   */
  getWormholes() {
    return this.wormholes;
  }

  /**
   * Get all players
   * @returns {Array|null} Players array or null
   */
  getPlayers() {
    return this.players;
  }

  /**
   * Get game info (map_size, seed, etc.)
   * @returns {Object|null} Game info or null
   */
  getGameInfo() {
    return this.gameInfo;
  }

  /**
   * Get current turn
   * @returns {Object|null} Current turn or null
   */
  getTurn() {
    return this.turn;
  }

  /**
   * Get star states
   * @returns {Array|null} Star states array or null
   */
  getState() {
    return this.state;
  }

  /**
   * Get all ships
   * @returns {Array|null} Ships array or null
   */
  getShips() {
    return this.ships;
  }

  /**
   * Get all orders
   * @returns {Array|null} Orders array or null
   */
  getOrders() {
    return this.orders;
  }

  /**
   * Get all events
   * @returns {Array|null} Events array or null
   */
  getEvents() {
    return this.events;
  }

  /**
   * Get current player ID
   * @returns {string|null} Current player ID or null
   */
  getCurrentPlayerId() {
    return this.currentPlayerId;
  }

  /**
   * Get complete game state
   * @returns {Object} Complete game state object
   */
  getGameState() {
    return {
      gameId: this.gameId,
      stars: this.stars,
      wormholes: this.wormholes,
      players: this.players,
      gameInfo: this.gameInfo,
      turn: this.turn,
      state: this.state,
      ships: this.ships,
      orders: this.orders,
      events: this.events,
      currentPlayerId: this.currentPlayerId
    };
  }
}

// Create singleton instance
let gameStateManagerInstance = null;

/**
 * Get the singleton GameStateManager instance
 * @returns {GameStateManager} The singleton instance
 */
export function getGameStateManager() {
  if (!gameStateManagerInstance) {
    gameStateManagerInstance = new GameStateManager();
  }
  return gameStateManagerInstance;
}

// Export the singleton instance directly for convenience
export const gameStateManager = getGameStateManager();

