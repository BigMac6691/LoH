import * as THREE from 'three';
import { eventBus, STAR_EVENTS } from './eventBus.js';
import { IndustryDialog } from './IndustryDialog.js';
import { MoveDialog } from './MoveDialog.js';

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
    this.menuRadius = 30; // Pixel radius
    this.iconSize = 30; // Pixel size
    this.animationDuration = 200; // ms
    this.hoverRadius = 40; // Pixel hover radius
    
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
    

    
    // Icon tracking
    this.icons = [];
    this.hoveredIcon = null;
    
    // Mouse tracking
    this.mouse = { x: 0, y: 0 };
    this.menuScreenPosition = { x: 0, y: 0 };
    
    // Dynamic radius tracking
    this.dynamicMenuRadius = null;
    this.currentWorldPosition = null;
    this.lastHoverState = false;
    
    // Dialogs
    this.industryDialog = new IndustryDialog();
    this.moveDialog = new MoveDialog();
    
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
    
    // Use dynamic hover radius based on menu radius
    const hoverRadius = this.dynamicMenuRadius ? this.dynamicMenuRadius + 20 : this.hoverRadius;
    
    const inArea = distance <= hoverRadius;
    
    // Debug logging (can be removed later)
    if (inArea !== this.lastHoverState) {
  
      this.lastHoverState = inArea;
    }
    
    return inArea;
  }

  /**
   * Handle star hover event
   * @param {Object} data - Event data containing star and position
   */
  onStarHover(data) {
    const starName = data.star.getName ? data.star.getName() : `Star ${data.star.id}`;
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
      // Already showing for this star - don't update position to avoid reset
      return;
    }

    // Hide any existing menu only if switching to a different star
    if (this.currentStar !== star) {
    this.hide();
    }
    
    this.currentStar = star;
    this.isVisible = true;
    
    // Project 3D position to screen coordinates
    this.updateMenuPosition(position);

    // Only create icons if we don't have them yet
    if (!this.icons || this.icons.length === 0) {
      // Define icon configurations
      const iconConfigs = [
        { symbol: '🏭', tooltip: 'Industry', action: 'industry' },
        { symbol: '🚀', tooltip: 'Move', action: 'move' }
      ];

      // Calculate angular spacing for 270° span
      const totalSpan = 270 * (Math.PI / 180); // Convert to radians
      const startAngle = 135 * (Math.PI / 180); // Start at 135° (bottom-left)
      const spacing = totalSpan / (iconConfigs.length + 1);

      // Create icons with calculated positions
      this.icons = iconConfigs.map((config, index) => {
        const angle = startAngle + (spacing * (index + 1));
        return this.createIcon(config.symbol, config.tooltip, angle, () => {
          const starName = star.getName ? star.getName() : `Star ${star.id}`;
          console.log(`${starName} - ${config.action}`);
          
          // Handle specific actions
          if (config.action === 'industry') {
            this.industryDialog.show(star);
          } else if (config.action === 'move') {
            this.moveDialog.show(star);
          }
        });
      });


    } else {
      // Update existing icon positions
      this.updateIconPositions();

    }
  }

  /**
   * Update positions of existing icons based on current menu position
   */
  updateIconPositions() {
    if (!this.icons || this.icons.length === 0) return;
    
    const totalSpan = 270 * (Math.PI / 180);
    const startAngle = 135 * (Math.PI / 180);
    const spacing = totalSpan / (this.icons.length + 1);
    
    this.icons.forEach((icon, index) => {
      const angle = startAngle + (spacing * (index + 1));
      const radius = this.dynamicMenuRadius || this.menuRadius;
      
      icon.screenX = this.menuScreenPosition.x + Math.cos(angle) * radius;
      icon.screenY = this.menuScreenPosition.y + Math.sin(angle) * radius;
      icon.angle = angle;
    });
  }

  /**
   * Calculate the projected radius of a sphere in pixels on screen
   * @param {THREE.Mesh} mesh - The mesh to calculate projected radius for
   * @param {THREE.Vector3} worldPosition - World position of the star group
   * @param {THREE.Camera} camera - The camera
   * @param {HTMLCanvasElement} canvas - The canvas element
   * @returns {number} Projected radius in pixels
   */
  getProjectedRadius(mesh, worldPosition, camera, canvas) {
    // Get the sphere's radius (assuming it's a sphere geometry)
    const geometry = mesh.geometry;
    const boundingSphere = geometry.boundingSphere || geometry.computeBoundingSphere();
    const radius = boundingSphere.radius;
    
    // Get the distance from camera to star center (use world position, not mesh position)
    const distance = camera.position.distanceTo(worldPosition);
    
    // Calculate the projected radius using similar triangles
    // tan(angle) = radius / distance = projectedRadius / (canvas.height / 2)
    const fov = camera.fov * (Math.PI / 180); // Convert to radians
    const projectedRadius = (radius / distance) * (canvas.height / 2) / Math.tan(fov / 2);
    
    return Math.max(projectedRadius, 5); // Minimum 5 pixels
  }

  /**
   * Update menu position based on 3D star position
   * @param {THREE.Vector3} position - 3D position
   */
  updateMenuPosition(position) {
    // Store the original world position
    this.currentWorldPosition = position.clone();
    
    // Clone the position to avoid modifying the original
    const worldPosition = position.clone();
    
    // Project 3D position to screen coordinates
    worldPosition.project(this.camera);
    
    // Convert to screen coordinates
    this.menuScreenPosition.x = (worldPosition.x + 1) * window.innerWidth / 2;
    this.menuScreenPosition.y = (-worldPosition.y + 1) * window.innerHeight / 2;
    
    // Calculate dynamic menu radius based on projected star size
    if (this.currentStar && this.currentStar.mesh) {
      const projectedRadius = this.getProjectedRadius(this.currentStar.mesh, this.currentWorldPosition, this.camera, this.canvas);
      this.dynamicMenuRadius = projectedRadius + 30; // 30 pixels beyond star edge
    }
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
    // Use dynamic radius if available, otherwise fall back to fixed radius
    const radius = this.dynamicMenuRadius || this.menuRadius;
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
    this.dynamicMenuRadius = null;
    this.currentWorldPosition = null;
    this.lastHoverState = false;
    

  }

  /**
   * Render the menu to canvas
   */
  render() {
    // Clear canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (!this.isVisible || !this.currentStar) {
      requestAnimationFrame(() => this.render());
      return;
    }
    
    // Don't update position in render loop - position is set once in show()
    // The continuous position updates were causing the (0,0,0) reset issue
    // this.updateMenuPosition(this.currentStar.mesh.position);
    
    // Update icon positions
    this.icons.forEach(icon => {
      const radius = this.dynamicMenuRadius || this.menuRadius;
      icon.screenX = this.menuScreenPosition.x + Math.cos(icon.angle) * radius;
      icon.screenY = this.menuScreenPosition.y + Math.sin(icon.angle) * radius;
    });
    
    // Draw hover boundary circle (disabled for debugging)
    // this.drawHoverCircle();
    
    // Draw debug crosshair at menu center (temporary)
    this.context.strokeStyle = 'red';
    this.context.lineWidth = 3;
    this.context.beginPath();
    this.context.moveTo(this.menuScreenPosition.x - 15, this.menuScreenPosition.y);
    this.context.lineTo(this.menuScreenPosition.x + 15, this.menuScreenPosition.y);
    this.context.moveTo(this.menuScreenPosition.x, this.menuScreenPosition.y - 15);
    this.context.lineTo(this.menuScreenPosition.x, this.menuScreenPosition.y + 15);
    this.context.stroke();
    
    // Draw hover area circle (temporary) - RED circle
    const hoverRadius = this.dynamicMenuRadius ? this.dynamicMenuRadius + 20 : this.hoverRadius;
    this.context.strokeStyle = 'red';
    this.context.lineWidth = 2;
    this.context.beginPath();
    this.context.arc(this.menuScreenPosition.x, this.menuScreenPosition.y, hoverRadius, 0, Math.PI * 2);
    this.context.stroke();
    


    // Draw icons
    this.icons.forEach(icon => {
      this.drawIcon(icon);
    });
    
    requestAnimationFrame(() => this.render());
  }

  /**
   * Draw hover boundary circle
   */
  drawHoverCircle() {
    this.context.save();
    
    // Use dynamic hover radius based on menu radius
    const hoverRadius = this.dynamicMenuRadius ? this.dynamicMenuRadius + 20 : this.hoverRadius;
    
    // Draw circle
    this.context.beginPath();
    this.context.arc(this.menuScreenPosition.x, this.menuScreenPosition.y, hoverRadius, 0, Math.PI * 2);
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
    
    // Dispose dialogs
    if (this.industryDialog) {
      this.industryDialog.dispose();
    }
    if (this.moveDialog) {
      this.moveDialog.dispose();
    }
    
    // Remove canvas from DOM
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
} 