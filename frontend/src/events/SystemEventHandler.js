/**
 * System Event Handler - Manages system-level events and context
 * Handles user login, game selection, and other system-wide events
 */
import { eventBus } from '../eventBus.js';

export class SystemEventHandler {
  constructor() {
    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for system events
   */
  setupEventListeners() {
    // Listen for login events
    eventBus.on('system:login', this.handleLogin.bind(this));
  }

  /**
   * Handle user login event
   * @param {Object} userData - User data from login
   */
  handleLogin(userData) {
    console.log('🔐 SystemEventHandler: Processing login for user:', userData);
    
    // Set user in context via event bus
    eventBus.setUser(userData);
    
    // Emit user ready event
    eventBus.emit('system:userReady', eventBus.getContext());
  }





  /**
   * Clean up event listeners
   */
  dispose() {
    eventBus.off('system:login', this.handleLogin.bind(this));
  }
}
