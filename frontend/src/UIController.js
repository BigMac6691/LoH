import { DEV_MODE } from './devScenarios.js';

/**
 * UIController - Handles UI interactions for map generation
 */
export class UIController {
  constructor() {
    
    this.init();
  }

  /**
   * Initialize the UI controller
   */
  init() {
    // Don't create panel automatically - only when showPanel() is called
    this.initializeEventListeners();
  }

  /**
   * Initialize all event listeners for the UI
   */
  initializeEventListeners() {
    // Event listeners will be set up when the panel is created
    // This method is called during initialization but elements don't exist yet
  }
} 