import { DualSlider } from './DualSlider.js';
import { DEV_MODE } from './devScenarios.js';

/**
 * UIController - Handles UI interactions for map generation
 */
export class UIController {
  constructor() {
    this.panel = null;
    this.mapSizeInput = null;
    this.mapSizeValue = null;
    this.starDensitySliderContainer = null;
    this.seedInput = null;
    this.generateBtn = null;
    this.starDensitySlider = null;
    
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
   * Create the map generation panel dynamically
   */
  createPanel() {
    // Create main panel container
    this.panel = document.createElement('div');
    this.panel.id = 'mapGenPanel';
    this.panel.className = 'ui-panel';
    this.panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #00ff88;
      border-radius: 15px;
      padding: 30px;
      color: white;
      z-index: 1000;
      min-width: 400px;
      max-width: 500px;
      backdrop-filter: blur(10px);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    // Create header
    const header = document.createElement('h2');
    header.textContent = 'Generate Map';
    header.style.cssText = `
      margin: 0 0 25px 0;
      text-align: center;
      color: #00ff88;
      font-size: 28px;
    `;

    // Create map size form group
    const mapSizeGroup = this.createFormGroup('Map Size (2-9)', 'mapSize');
    this.mapSizeInput = mapSizeGroup.input;
    this.mapSizeValue = mapSizeGroup.value;

    // Create star density form group
    const starDensityGroup = this.createFormGroup('Star Density Range (0-9)', 'starDensitySlider');
    this.starDensitySliderContainer = starDensityGroup.container;

    // Create seed form group
    const seedGroup = this.createFormGroup('Seed', 'seed', 'number');
    this.seedInput = seedGroup.input;
    this.seedInput.value = '12345';

    // Create generate button
    this.generateBtn = document.createElement('button');
    this.generateBtn.className = 'generate-btn';
    this.generateBtn.textContent = 'Generate Map';
    this.generateBtn.style.cssText = `
      width: 100%;
      padding: 15px;
      background: linear-gradient(45deg, #00ff88, #00cc6a);
      border: none;
      border-radius: 5px;
      color: #000;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      margin-top: 20px;
    `;

    // Assemble the panel
    this.panel.appendChild(header);
    this.panel.appendChild(mapSizeGroup.element);
    this.panel.appendChild(starDensityGroup.element);
    this.panel.appendChild(seedGroup.element);
    this.panel.appendChild(this.generateBtn);

    // Add to document
    document.body.appendChild(this.panel);

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

    // Set up event listeners for the panel
    this.setupPanelEventListeners();
  }

  /**
   * Create a form group with label and input
   * @param {string} labelText - Label text
   * @param {string} inputId - Input ID
   * @param {string} inputType - Input type (default: 'range')
   * @returns {Object} Form group elements
   */
  createFormGroup(labelText, inputId, inputType = 'range') {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.style.cssText = `
      margin-bottom: 20px;
    `;

    const label = document.createElement('label');
    label.textContent = labelText;
    label.style.cssText = `
      display: block;
      margin-bottom: 8px;
      color: #ccc;
      font-size: 14px;
    `;

    if (inputType === 'range') {
      const input = document.createElement('input');
      input.type = 'range';
      input.id = inputId;
      input.min = inputId === 'mapSize' ? '2' : '0';
      input.max = '9';
      input.value = inputId === 'mapSize' ? '5' : '2';
      input.style.cssText = `
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: #333;
        outline: none;
        cursor: pointer;
      `;

      const valueSpan = document.createElement('span');
      valueSpan.className = 'range-value';
      valueSpan.id = inputId === 'mapSize' ? 'mapSizeValue' : null;
      valueSpan.textContent = input.value;
      valueSpan.style.cssText = `
        display: inline-block;
        margin-left: 10px;
        color: #00ff88;
        font-weight: bold;
      `;

      group.appendChild(label);
      group.appendChild(input);
      group.appendChild(valueSpan);

      return {
        element: group,
        input: input,
        value: valueSpan,
        container: null
      };
    } else if (inputType === 'number') {
      const input = document.createElement('input');
      input.type = 'number';
      input.id = inputId;
      input.placeholder = 'Enter seed number';
      input.style.cssText = `
        width: 100%;
        padding: 10px;
        border: 1px solid #333;
        border-radius: 5px;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        font-size: 16px;
        box-sizing: border-box;
      `;

      group.appendChild(label);
      group.appendChild(input);

      return {
        element: group,
        input: input,
        value: null,
        container: null
      };
    } else if (inputId === 'starDensitySlider') {
      const container = document.createElement('div');
      container.id = inputId;
      container.style.cssText = `
        margin-top: 10px;
      `;

      group.appendChild(label);
      group.appendChild(container);

      return {
        element: group,
        input: null,
        value: null,
        container: container
      };
    }
  }

  /**
   * Initialize all event listeners for the UI
   */
  initializeEventListeners() {
    // Event listeners will be set up when the panel is created
    // This method is called during initialization but elements don't exist yet
  }

  /**
   * Set up event listeners for the panel elements
   */
  setupPanelEventListeners() {
    if (!this.mapSizeInput || !this.generateBtn || !this.seedInput) {
      return;
    }

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
    if (this.panel) {
      this.panel.style.display = 'none';
    }
  }

  /**
   * Show the UI panel
   */
  showPanel() {
    // Suppress panel in dev mode
    if (DEV_MODE) {
      console.log('🔧 DEV MODE: Suppressing map generation panel');
      return;
    }
    
    // Create panel if it doesn't exist
    if (!this.panel) {
      this.createPanel();
    }
    
    this.panel.style.display = 'block';
  }

  /**
   * Call the generateMap function with the configuration
   * @param {Object} config - Configuration object
   */
  callGenerateMap(config) {
    // Map generation is now handled by backend only
    console.log('Map generation config:', config);
    alert(`Map generation moved to backend.\nUse the BackendTestPanel to create games.\n\nConfig would have been:\nMap Size: ${config.mapSize}\nStar Density: ${config.starDensity}\nSeed: ${config.seed}`);
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