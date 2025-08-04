/**
 * DualSlider - A reusable dual-handle range slider component
 */
export class DualSlider {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      min: 0,
      max: 9,
      minValue: 2,
      maxValue: 7,
      step: 1,
      width: 300,
      height: 60,
      onChange: null,
      ...options
    };
    
    this.isDragging = false;
    this.dragTarget = null; // 'min' or 'max'
    this.element = null;
    this.minHandle = null;
    this.maxHandle = null;
    this.track = null;
    this.minLabel = null;
    this.maxLabel = null;
    this.fill = null;
    
    this.init();
  }

  /**
   * Initialize the slider component
   */
  init() {
    this.createElements();
    this.setupEventListeners();
    this.updateDisplay();
  }

  /**
   * Create the DOM elements for the slider
   */
  createElements() {
    // Create main container
    this.element = document.createElement('div');
    this.element.className = 'dual-slider';
    this.element.style.cssText = `
      position: relative;
      width: ${this.options.width}px;
      height: ${this.options.height}px;
      margin: 10px 0;
    `;

    // Create track
    this.track = document.createElement('div');
    this.track.className = 'dual-slider-track';
    this.track.style.cssText = `
      position: absolute;
      top: 20px;
      left: 10px;
      right: 10px;
      height: 6px;
      background: #333;
      border-radius: 3px;
      cursor: pointer;
    `;

    // Create fill (the colored part between handles)
    this.fill = document.createElement('div');
    this.fill.className = 'dual-slider-fill';
    this.fill.style.cssText = `
      position: absolute;
      top: 0;
      height: 100%;
      background: #00ff88;
      border-radius: 3px;
      pointer-events: none;
    `;

    // Create min handle
    this.minHandle = document.createElement('div');
    this.minHandle.className = 'dual-slider-handle dual-slider-handle-min';
    this.minHandle.style.cssText = `
      position: absolute;
      top: 15px;
      width: 20px;
      height: 20px;
      background: #00ff88;
      border: 2px solid #fff;
      border-radius: 50%;
      cursor: pointer;
      z-index: 2;
      transition: transform 0.1s ease;
    `;

    // Create max handle
    this.maxHandle = document.createElement('div');
    this.maxHandle.className = 'dual-slider-handle dual-slider-handle-max';
    this.maxHandle.style.cssText = `
      position: absolute;
      top: 15px;
      width: 20px;
      height: 20px;
      background: #00ff88;
      border: 2px solid #fff;
      border-radius: 50%;
      cursor: pointer;
      z-index: 2;
      transition: transform 0.1s ease;
    `;

    // Create min label
    this.minLabel = document.createElement('div');
    this.minLabel.className = 'dual-slider-label dual-slider-label-min';
    this.minLabel.style.cssText = `
      position: absolute;
      top: 40px;
      color: #00ff88;
      font-size: 12px;
      font-weight: bold;
      text-align: center;
      transform: translateX(-50%);
      min-width: 20px;
    `;

    // Create max label
    this.maxLabel = document.createElement('div');
    this.maxLabel.className = 'dual-slider-label dual-slider-label-max';
    this.maxLabel.style.cssText = `
      position: absolute;
      top: 40px;
      color: #00ff88;
      font-size: 12px;
      font-weight: bold;
      text-align: center;
      transform: translateX(-50%);
      min-width: 20px;
    `;

    // Assemble the component
    this.track.appendChild(this.fill);
    this.element.appendChild(this.track);
    this.element.appendChild(this.minHandle);
    this.element.appendChild(this.maxHandle);
    this.element.appendChild(this.minLabel);
    this.element.appendChild(this.maxLabel);
    this.container.appendChild(this.element);
  }

  /**
   * Setup event listeners for mouse/touch interactions
   */
  setupEventListeners() {
    // Mouse events
    this.minHandle.addEventListener('mousedown', (e) => this.startDrag(e, 'min'));
    this.maxHandle.addEventListener('mousedown', (e) => this.startDrag(e, 'max'));
    this.track.addEventListener('mousedown', (e) => this.handleTrackClick(e));
    
    document.addEventListener('mousemove', (e) => this.handleDrag(e));
    document.addEventListener('mouseup', () => this.stopDrag());

    // Touch events for mobile
    this.minHandle.addEventListener('touchstart', (e) => this.startDrag(e, 'min'));
    this.maxHandle.addEventListener('touchstart', (e) => this.startDrag(e, 'max'));
    this.track.addEventListener('touchstart', (e) => this.handleTrackClick(e));
    
    document.addEventListener('touchmove', (e) => this.handleDrag(e));
    document.addEventListener('touchend', () => this.stopDrag());
  }

  /**
   * Start dragging a handle
   */
  startDrag(e, target) {
    e.preventDefault();
    this.isDragging = true;
    this.dragTarget = target;
    
    // Add visual feedback
    const handle = target === 'min' ? this.minHandle : this.maxHandle;
    handle.style.transform = 'scale(1.2)';
  }

  /**
   * Handle dragging motion
   */
  handleDrag(e) {
    if (!this.isDragging) return;
    
    e.preventDefault();
    
    const rect = this.track.getBoundingClientRect();
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const percentage = x / rect.width;
    const value = Math.round(this.options.min + percentage * (this.options.max - this.options.min));
    
    this.setValue(this.dragTarget, value);
  }

  /**
   * Handle clicking on the track
   */
  handleTrackClick(e) {
    e.preventDefault();
    
    const rect = this.track.getBoundingClientRect();
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const percentage = x / rect.width;
    const value = Math.round(this.options.min + percentage * (this.options.max - this.options.min));
    
    // Determine which handle to move based on which is closer
    const minDistance = Math.abs(value - this.options.minValue);
    const maxDistance = Math.abs(value - this.options.maxValue);
    const target = minDistance <= maxDistance ? 'min' : 'max';
    
    this.setValue(target, value);
  }

  /**
   * Stop dragging
   */
  stopDrag() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.dragTarget = null;
    
    // Remove visual feedback
    this.minHandle.style.transform = 'scale(1)';
    this.maxHandle.style.transform = 'scale(1)';
  }

  /**
   * Set a value for min or max handle
   */
  setValue(target, value) {
    // Constrain value to range
    value = Math.max(this.options.min, Math.min(this.options.max, value));
    
    if (target === 'min') {
      this.options.minValue = value;
      // Ensure min doesn't exceed max
      if (this.options.minValue >= this.options.maxValue) {
        this.options.maxValue = Math.min(this.options.max, this.options.minValue + 1);
      }
    } else {
      this.options.maxValue = value;
      // Ensure max doesn't go below min
      if (this.options.maxValue <= this.options.minValue) {
        this.options.minValue = Math.max(this.options.min, this.options.maxValue - 1);
      }
    }
    
    this.updateDisplay();
    
    // Call onChange callback if provided
    if (this.options.onChange) {
      this.options.onChange({
        min: this.options.minValue,
        max: this.options.maxValue
      });
    }
  }

  /**
   * Update the visual display of the slider
   */
  updateDisplay() {
    const trackWidth = this.track.offsetWidth;
    const range = this.options.max - this.options.min;
    
    // Calculate positions
    const minPosition = ((this.options.minValue - this.options.min) / range) * trackWidth;
    const maxPosition = ((this.options.maxValue - this.options.min) / range) * trackWidth;
    
    // Update handle positions
    this.minHandle.style.left = `${minPosition}px`;
    this.maxHandle.style.left = `${maxPosition}px`;
    
    // Update fill
    this.fill.style.left = `${minPosition}px`;
    this.fill.style.width = `${maxPosition - minPosition}px`;
    
    // Update labels
    this.minLabel.textContent = this.options.minValue;
    this.maxLabel.textContent = this.options.maxValue;
    this.minLabel.style.left = `${minPosition}px`;
    this.maxLabel.style.left = `${maxPosition}px`;
  }

  /**
   * Get current values
   */
  getValues() {
    return {
      min: this.options.minValue,
      max: this.options.maxValue
    };
  }

  /**
   * Set values programmatically
   */
  setValues(min, max) {
    this.options.minValue = Math.max(this.options.min, Math.min(this.options.max, min));
    this.options.maxValue = Math.max(this.options.min, Math.min(this.options.max, max));
    
    // Ensure min <= max
    if (this.options.minValue > this.options.maxValue) {
      [this.options.minValue, this.options.maxValue] = [this.options.maxValue, this.options.minValue];
    }
    
    this.updateDisplay();
  }

  /**
   * Destroy the component and clean up
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
} 