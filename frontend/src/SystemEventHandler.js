/**
 * System Event Handler - Manages system-level events and context
 * Handles user login, game selection, and other system-wide events
 */
import { eventBus } from './eventBus.js';

export class SystemEventHandler {
  constructor() {
    this.context = {
      user: null,
      gameId: null
    };
    
    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for system events
   */
  setupEventListeners() {
    // Listen for login events
    eventBus.on('system:login', this.handleLogin.bind(this));
    
    // Listen for game load events
    eventBus.on('system:gameLoad', this.handleGameLoad.bind(this));
  }

  /**
   * Handle user login event
   * @param {Object} userData - User data from login
   */
  handleLogin(userData) {
    console.log('🔐 SystemEventHandler: Processing login for user:', userData);
    
    // Set user in context
    this.setUser(userData);
    
    // Emit user ready event
    eventBus.emit('system:userReady', this.context);
  }

  /**
   * Handle game load event
   * @param {string} gameId - Game ID to load
   */
  handleGameLoad(gameId) {
    console.log('🎮 SystemEventHandler: Processing game load for game:', gameId);
    
    // Set game in context
    this.setGameId(gameId);
    
    // Emit game ready event
    eventBus.emit('system:gameReady', this.context);
  }

  /**
   * Set current user in context
   * @param {Object} user - User data
   */
  setUser(user) {
    this.context.user = user;
    console.log('👤 SystemEventHandler: User context updated:', user);
  }

  /**
   * Set current game ID in context
   * @param {string} gameId - Game ID
   */
  setGameId(gameId) {
    this.context.gameId = gameId;
    console.log('🎯 SystemEventHandler: Game context updated:', gameId);
  }

  /**
   * Get current context
   * @returns {Object} Current context with user and gameId
   */
  getContext() {
    return { ...this.context };
  }

  /**
   * Check if user is logged in
   * @returns {boolean} True if user is set
   */
  isUserLoggedIn() {
    return this.context.user !== null;
  }

  /**
   * Check if game is loaded
   * @returns {boolean} True if gameId is set
   */
  isGameLoaded() {
    return this.context.gameId !== null;
  }

  /**
   * Clear context (useful for logout)
   */
  clearContext() {
    this.context.user = null;
    this.context.gameId = null;
    console.log('🧹 SystemEventHandler: Context cleared');
  }

  /**
   * Clean up event listeners
   */
  dispose() {
    eventBus.off('system:login', this.handleLogin.bind(this));
    eventBus.off('system:gameLoad', this.handleGameLoad.bind(this));
  }
}
