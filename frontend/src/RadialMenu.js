import * as THREE from 'three';
import { eventBus, STAR_EVENTS } from './eventBus.js';

/**
 * RadialMenu - Displays a radial context menu for star interactions using 2D canvas
 */
export class RadialMenu {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.currentStar = null;
    this.isVisible = false;
    
    // Menu configuration (in pixels)
    this.menuRadius = 60; // Pixel radius
    this.iconSize = 40; // Pixel size
    this.animationDuration = 200; // ms
    this.hoverRadius = 80; // Pixel hover radius
    
    // Canvas setup
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0px';
    this.canvas.style.left = '0px';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '1000';
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    document.body.appendChild(this.canvas);
    
    console.log('🎯 RadialMenu: Canvas created with size:', this.canvas.width, 'x', this.canvas.height);
    
    // Icon tracking
    this.icons = [];
    this.hoveredIcon = null;
    
    // Mouse tracking
    this.mouse = { x: 0, y: 0 };
    this.menuScreenPosition = { x: 0, y: 0 };
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Start rendering
    this.render();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for star hover events
    eventBus.on(STAR_EVENTS.HOVER, this.onStarHover.bind(this));
    eventBus.on(STAR_EVENTS.UNHOVER, this.onStarUnhover.bind(this));
    
    // Track mouse movement for hover area detection
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    
    // Add click detection for icons
    document.addEventListener('click', this.onClick.bind(this));
    
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  /**
   * Handle mouse movement for hover area detection
   * @param {MouseEvent} event - Mouse event
   */
  onMouseMove(event) {
    this.mouse.x = event.clientX;
    this.mouse.y = event.clientY;
    
    // Check for icon hover
    this.checkIconHover();
    
    // Check if we should hide the menu when mouse leaves hover area
    if (this.isVisible && !this.isMouseInHoverArea()) {
      this.hide();
    }
  }

  /**
   * Check for icon hover
   */
  checkIconHover() {
    if (!this.isVisible) return;
    
    let hoveredIcon = null;
    
    // Check each icon for hover
    this.icons.forEach(icon => {
      const distance = Math.sqrt(
        Math.pow(this.mouse.x - icon.screenX, 2) + 
        Math.pow(this.mouse.y - icon.screenY, 2)
      );
      
      if (distance <= this.iconSize / 2) {
        hoveredIcon = icon;
      }
    });
    
    if (hoveredIcon !== this.hoveredIcon) {
      if (this.hoveredIcon) {
        this.onIconUnhover();
      }
      if (hoveredIcon) {
        this.onIconHover(hoveredIcon);
      }
    }
  }

  /**
   * Handle icon hover
   * @param {Object} icon - Icon object
   */
  onIconHover(icon) {
    this.hoveredIcon = icon;
    console.log('🎯 RadialMenu: Hovering over icon:', icon.symbol);
  }

  /**
   * Handle icon unhover
   */
  onIconUnhover() {
    this.hoveredIcon = null;
  }

  /**
   * Check if mouse is within the hover area
   * @returns {boolean} True if mouse is in hover area
   */
  isMouseInHoverArea() {
    if (!this.isVisible) return false;
    
    const distance = Math.sqrt(
      Math.pow(this.mouse.x - this.menuScreenPosition.x, 2) + 
      Math.pow(this.mouse.y - this.menuScreenPosition.y, 2)
    );
    
    return distance <= this.hoverRadius;
  }

  /**
   * Handle star hover event
   * @param {Object} data - Event data containing star and position
   */
  onStarHover(data) {
    this.show(data.position, data.star);
  }

  /**
   * Handle star unhover event
   * @param {Object} data - Event data containing star
   */
  onStarUnhover(data) {
    // Only hide if the unhovered star is the one we're showing for
    if (this.currentStar === data.star) {
      this.hide();
    }
  }

  /**
   * Handle click events for icon interaction
   * @param {MouseEvent} event - Mouse event
   */
  onClick(event) {
    if (!this.isVisible) return;
    
    this.icons.forEach(icon => {
      const distance = Math.sqrt(
        Math.pow(event.clientX - icon.screenX, 2) + 
        Math.pow(event.clientY - icon.screenY, 2)
      );
      
      if (distance <= this.iconSize / 2) {
        if (icon.onClick) {
          icon.onClick();
        }
      }
    });
  }

  /**
   * Show the radial menu at the specified position
   * @param {THREE.Vector3} position - 3D position to show menu at
   * @param {Object} star - Star object for context
   */
  show(position, star) {
    if (this.isVisible && this.currentStar === star) {
      return; // Already showing for this star
    }

    this.hide(); // Hide any existing menu
    this.currentStar = star;
    this.isVisible = true;

    console.log('🎯 RadialMenu: Creating menu at position:', position);

    // Project 3D position to screen coordinates
    this.updateMenuPosition(position);

    // Create industry icon
    const industryIcon = this.createIcon('🏭', 'Industry', 0, () => {
      const starName = star.getName ? star.getName() : `Star ${star.id}`;
      console.log(`${starName} - industry`);
    });

    this.icons = [industryIcon];

    console.log('🎯 RadialMenu: Menu created with icon at screen position:', this.menuScreenPosition);
  }

  /**
   * Update menu position based on 3D star position
   * @param {THREE.Vector3} position - 3D position
   */
  updateMenuPosition(position) {
    // Clone the position to avoid modifying the original
    const worldPosition = position.clone();
    
    // Project 3D position to screen coordinates
    worldPosition.project(this.camera);
    
    // Convert to screen coordinates
    this.menuScreenPosition.x = (worldPosition.x + 1) * window.innerWidth / 2;
    this.menuScreenPosition.y = (-worldPosition.y + 1) * window.innerHeight / 2;
  }

  /**
   * Create a menu icon
   * @param {string} symbol - Icon symbol/emoji
   * @param {string} tooltip - Tooltip text
   * @param {number} angle - Angle in radians
   * @param {Function} onClick - Click handler
   * @returns {Object} Icon object
   */
  createIcon(symbol, tooltip, angle, onClick) {
    // Calculate icon position around the circle
    const radius = this.menuRadius;
    const screenX = this.menuScreenPosition.x + Math.cos(angle) * radius;
    const screenY = this.menuScreenPosition.y + Math.sin(angle) * radius;
    
    const icon = {
      symbol: symbol,
      tooltip: tooltip,
      angle: angle,
      onClick: onClick,
      screenX: screenX,
      screenY: screenY,
      size: this.iconSize,
      isHovered: false
    };
    
    console.log('🎯 RadialMenu: Created icon at screen position:', { x: screenX, y: screenY });
    
    return icon;
  }

  /**
   * Hide the radial menu
   */
  hide() {
    if (!this.isVisible) return;

    this.isVisible = false;
    this.currentStar = null;
    this.icons = [];
    this.hoveredIcon = null;
    
    console.log('🎯 RadialMenu: Menu hidden');
  }

  /**
   * Render the menu to canvas
   */
  render() {
    // Clear canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Debug: Draw a test circle to verify rendering is working
    this.context.save();
    this.context.beginPath();
    this.context.arc(100, 100, 20, 0, Math.PI * 2);
    this.context.fillStyle = 'red';
    this.context.fill();
    this.context.restore();
    
    if (!this.isVisible || !this.currentStar) {
      requestAnimationFrame(() => this.render());
      return;
    }
    
    // Update menu position based on current star position
    this.updateMenuPosition(this.currentStar.mesh.position);
    
    // Update icon positions
    this.icons.forEach(icon => {
      const radius = this.menuRadius;
      icon.screenX = this.menuScreenPosition.x + Math.cos(icon.angle) * radius;
      icon.screenY = this.menuScreenPosition.y + Math.sin(icon.angle) * radius;
    });
    
    // Draw hover boundary circle
    this.drawHoverCircle();
    
    // Draw icons
    this.icons.forEach(icon => {
      this.drawIcon(icon);
    });
    
    console.log('🎯 RadialMenu: Rendered menu at screen position:', this.menuScreenPosition);
    
    requestAnimationFrame(() => this.render());
  }

  /**
   * Draw hover boundary circle
   */
  drawHoverCircle() {
    this.context.save();
    
    // Draw circle
    this.context.beginPath();
    this.context.arc(this.menuScreenPosition.x, this.menuScreenPosition.y, this.hoverRadius, 0, Math.PI * 2);
    this.context.strokeStyle = 'rgba(0, 255, 136, 0.5)';
    this.context.lineWidth = 2;
    this.context.stroke();
    
    this.context.restore();
  }

  /**
   * Draw an icon
   * @param {Object} icon - Icon object
   */
  drawIcon(icon) {
    this.context.save();
    
    const x = icon.screenX;
    const y = icon.screenY;
    const size = icon.size;
    const isHovered = icon === this.hoveredIcon;
    
    // Draw background circle
    this.context.beginPath();
    this.context.arc(x, y, size / 2, 0, Math.PI * 2);
    this.context.fillStyle = isHovered ? 'rgba(0, 255, 136, 0.2)' : 'rgba(0, 0, 0, 0.8)';
    this.context.fill();
    
    // Draw border
    this.context.strokeStyle = '#00ff88';
    this.context.lineWidth = isHovered ? 3 : 2;
    this.context.stroke();
    
    // Draw emoji
    this.context.font = `${size * 0.6}px Arial`;
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.fillStyle = 'white';
    this.context.fillText(icon.symbol, x, y);
    
    this.context.restore();
  }

  /**
   * Handle window resize
   */
  onWindowResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    console.log('🎯 RadialMenu: Canvas resized to:', this.canvas.width, 'x', this.canvas.height);
  }

  /**
   * Update the menu (called each frame)
   * @param {number} deltaTime - Time since last update
   */
  update(deltaTime) {
    // No additional updates needed - rendering is handled by render loop
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Remove event listeners
    eventBus.off(STAR_EVENTS.HOVER, this.onStarHover.bind(this));
    eventBus.off(STAR_EVENTS.UNHOVER, this.onStarUnhover.bind(this));
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    document.removeEventListener('click', this.onClick.bind(this));
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    
    this.hide();
    
    // Remove canvas from DOM
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
} 