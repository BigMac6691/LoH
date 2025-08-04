import { DualSlider } from './DualSlider.js';

/**
 * UIController - Handles UI interactions for map generation
 */
export class UIController {
  constructor() {
    this.panel = document.getElementById('mapGenPanel');
    this.mapSizeInput = document.getElementById('mapSize');
    this.mapSizeValue = document.getElementById('mapSizeValue');
    this.starDensitySliderContainer = document.getElementById('starDensitySlider');
    this.seedInput = document.getElementById('seed');
    this.generateBtn = document.getElementById('generateBtn');
    
    // Initialize the dual slider for star density
    this.starDensitySlider = new DualSlider(this.starDensitySliderContainer, {
      min: 0,
      max: 9,
      minValue: 2,
      maxValue: 7,
      width: 280,
      height: 60,
      onChange: (values) => {
        // Optional: handle real-time changes if needed
        console.log('Star density changed:', values);
      }
    });
    
    this.initializeEventListeners();
  }

  /**
   * Initialize all event listeners for the UI
   */
  initializeEventListeners() {
    // Map size range slider
    this.mapSizeInput.addEventListener('input', (e) => {
      this.mapSizeValue.textContent = e.target.value;
    });

    // Generate button click
    this.generateBtn.addEventListener('click', () => {
      this.handleGenerateClick();
    });

    // Enter key on seed input
    this.seedInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleGenerateClick();
      }
    });
  }

  /**
   * Handle the generate button click
   */
  handleGenerateClick() {
    const config = this.getConfig();
    
    if (this.validateConfig(config)) {
      this.hidePanel();
      this.callGenerateMap(config);
    }
  }

  /**
   * Get the current configuration from the form
   * @returns {Object} Configuration object
   */
  getConfig() {
    const starDensityValues = this.starDensitySlider.getValues();
    return {
      mapSize: parseInt(this.mapSizeInput.value),
      minStarDensity: starDensityValues.min,
      maxStarDensity: starDensityValues.max,
      seed: parseInt(this.seedInput.value) || 0
    };
  }

  /**
   * Validate the configuration values
   * @param {Object} config - Configuration object
   * @returns {boolean} True if valid, false otherwise
   */
  validateConfig(config) {
    // Validate map size
    if (config.mapSize < 2 || config.mapSize > 9) {
      this.showError('Map size must be between 2 and 9');
      return false;
    }

    // Validate star density values (dual slider handles constraints automatically)
    if (config.minStarDensity < 0 || config.minStarDensity > 9) {
      this.showError('Min star density must be between 0 and 9');
      return false;
    }

    if (config.maxStarDensity < 0 || config.maxStarDensity > 9) {
      this.showError('Max star density must be between 0 and 9');
      return false;
    }

    // Validate seed
    if (!Number.isFinite(config.seed)) {
      this.showError('Seed must be a valid number');
      return false;
    }

    return true;
  }

  /**
   * Show an error message to the user
   * @param {string} message - Error message to display
   */
  showError(message) {
    // Create temporary error message
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 0, 0, 0.9);
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      z-index: 3000;
      font-family: 'Segoe UI', sans-serif;
      font-size: 14px;
      animation: fadeInOut 3s ease-in-out;
    `;
    errorDiv.textContent = message;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        10% { opacity: 1; transform: translateX(-50%) translateY(0); }
        90% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(errorDiv);
    
    // Remove after animation
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 3000);
  }

  /**
   * Hide the UI panel
   */
  hidePanel() {
    this.panel.classList.add('hidden');
  }

  /**
   * Show the UI panel
   */
  showPanel() {
    this.panel.classList.remove('hidden');
  }

  /**
   * Call the generateMap function with the configuration
   * @param {Object} config - Configuration object
   */
  callGenerateMap(config) {
    // This function will be called by the main application
    // The actual implementation will be provided by the main.js
    if (window.generateMap && typeof window.generateMap === 'function') {
      window.generateMap(config);
    } else {
      console.log('Map generation config:', config);
      // Fallback: show the config in console for now
      alert(`Map generation called with:\nMap Size: ${config.mapSize}\nStar Density: ${config.starDensity}\nSeed: ${config.seed}`);
    }
  }

  /**
   * Reset the form to default values
   */
  resetForm() {
    this.mapSizeInput.value = 5;
    this.mapSizeValue.textContent = '5';
    this.starDensitySlider.setValues(2, 7);
    this.seedInput.value = 12345;
  }

  /**
   * Set form values programmatically
   * @param {Object} config - Configuration object
   */
  setConfig(config) {
    if (config.mapSize !== undefined) {
      this.mapSizeInput.value = config.mapSize;
      this.mapSizeValue.textContent = config.mapSize;
    }
    if (config.minStarDensity !== undefined || config.maxStarDensity !== undefined) {
      const currentValues = this.starDensitySlider.getValues();
      const min = config.minStarDensity !== undefined ? config.minStarDensity : currentValues.min;
      const max = config.maxStarDensity !== undefined ? config.maxStarDensity : currentValues.max;
      this.starDensitySlider.setValues(min, max);
    }
    if (config.seed !== undefined) {
      this.seedInput.value = config.seed;
    }
  }
} 