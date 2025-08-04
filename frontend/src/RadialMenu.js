import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { eventBus, STAR_EVENTS } from './eventBus.js';

/**
 * RadialMenu - Displays a radial context menu for star interactions
 */
export class RadialMenu {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.menuGroup = null;
    this.currentStar = null;
    this.isVisible = false;
    
    // Menu configuration
    this.menuRadius = 60;
    this.iconSize = 40;
    this.animationDuration = 200; // ms
    this.hoverRadius = 80; // Larger radius for easier menu interaction
    
    // Create CSS2D renderer for menu elements
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0px';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    this.labelRenderer.domElement.style.zIndex = '1000';
    document.body.appendChild(this.labelRenderer.domElement);
    
    // Mouse tracking for hover area
    this.mouse = { x: 0, y: 0 };
    this.menuScreenPosition = { x: 0, y: 0 };
    
    // Set up event listeners
    this.setupEventListeners();
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
  }

  /**
   * Handle mouse movement for hover area detection
   * @param {MouseEvent} event - Mouse event
   */
  onMouseMove(event) {
    this.mouse.x = event.clientX;
    this.mouse.y = event.clientY;
    
    // Check if we should hide the menu when mouse leaves hover area
    if (this.isVisible && !this.isMouseInHoverArea()) {
      this.hide();
    }
  }

  /**
   * Check if mouse is within the hover area (star + menu)
   * @returns {boolean} True if mouse is in hover area
   */
  isMouseInHoverArea() {
    if (!this.menuScreenPosition) {
      return false;
    }
    
    // Calculate distance from mouse to menu center
    const distance = Math.sqrt(
      Math.pow(this.mouse.x - this.menuScreenPosition.x, 2) + 
      Math.pow(this.mouse.y - this.menuScreenPosition.y, 2)
    );
    
    // Check if within hover radius
    return distance <= this.hoverRadius;
  }

  /**
   * Handle star hover event
   * @param {Object} data - Event data containing star and position
   */
  onStarHover(data) {
    this.show(data.position, data.star, data.screenPosition);
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
   * Show the radial menu at the specified position
   * @param {THREE.Vector3} position - 3D position to show menu at
   * @param {Object} star - Star object for context
   * @param {Object} screenPosition - Screen coordinates of the star
   */
  show(position, star, screenPosition) {
    if (this.isVisible && this.currentStar === star) {
      return; // Already showing for this star
    }

    this.hide(); // Hide any existing menu
    this.currentStar = star;
    this.isVisible = true;
    this.menuScreenPosition = screenPosition;

    // Create menu group
    this.menuGroup = new THREE.Group();
    this.scene.add(this.menuGroup);

    // Create industry icon
    const industryIcon = this.createIcon('🏭', 'Industry', 0, () => {
      const starName = star.getName ? star.getName() : `Star ${star.id}`;
      console.log(`${starName} - industry`);
    });

    // Position the menu group at the star's position
    this.menuGroup.position.copy(position);
    this.menuGroup.add(industryIcon);

    // Animate the menu appearance
    this.animateIn();
  }

  /**
   * Create a menu icon
   * @param {string} symbol - Icon symbol/emoji
   * @param {string} tooltip - Tooltip text
   * @param {number} angle - Angle in radians
   * @param {Function} onClick - Click handler
   * @returns {THREE.CSS2DObject} CSS2D object
   */
  createIcon(symbol, tooltip, angle, onClick) {
    // Create container div
    const container = document.createElement('div');
    container.className = 'radial-menu-icon';
    container.style.cssText = `
      position: absolute;
      width: ${this.iconSize}px;
      height: ${this.iconSize}px;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid #00ff88;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 20px;
      color: white;
      transition: all 0.2s ease;
      transform: scale(0);
      opacity: 0;
      pointer-events: auto;
      z-index: 1001;
    `;

    // Add hover effects
    container.addEventListener('mouseenter', () => {
      container.style.transform = 'scale(1.1)';
      container.style.background = 'rgba(0, 255, 136, 0.2)';
      container.style.borderColor = '#00ff88';
    });

    container.addEventListener('mouseleave', () => {
      container.style.transform = 'scale(1)';
      container.style.background = 'rgba(0, 0, 0, 0.8)';
      container.style.borderColor = '#00ff88';
    });

    // Add click handler
    container.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });

    // Add tooltip
    container.title = tooltip;

    // Set content
    container.textContent = symbol;

    // Create CSS2D object
    const css2dObject = new CSS2DObject(container);
    
    // Position the icon around the circle
    const radius = this.menuRadius;
    css2dObject.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0
    );

    return css2dObject;
  }

  /**
   * Animate the menu appearance
   */
  animateIn() {
    if (!this.menuGroup) return;

    const icons = this.menuGroup.children;
    icons.forEach((icon, index) => {
      const delay = index * 50; // Stagger the animations
      setTimeout(() => {
        if (icon.element) {
          icon.element.style.transform = 'scale(1)';
          icon.element.style.opacity = '1';
        }
      }, delay);
    });
  }

  /**
   * Animate the menu disappearance
   */
  animateOut() {
    if (!this.menuGroup) return;

    const icons = this.menuGroup.children;
    icons.forEach((icon) => {
      if (icon.element) {
        icon.element.style.transform = 'scale(0)';
        icon.element.style.opacity = '0';
      }
    });
  }

  /**
   * Hide the radial menu
   */
  hide() {
    if (!this.isVisible) return;

    this.animateOut();
    
    // Remove from scene after animation
    setTimeout(() => {
      if (this.menuGroup) {
        this.scene.remove(this.menuGroup);
        this.menuGroup = null;
      }
      this.isVisible = false;
      this.currentStar = null;
      this.menuScreenPosition = null;
    }, this.animationDuration);
  }

  /**
   * Update the menu (called each frame)
   * @param {number} deltaTime - Time since last frame
   */
  update(deltaTime) {
    // Update label renderer if needed
    if (this.labelRenderer) {
      this.labelRenderer.render(this.scene, this.camera);
    }
  }

  /**
   * Handle window resize
   */
  onWindowResize() {
    if (this.labelRenderer) {
      this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Remove event listeners
    eventBus.off(STAR_EVENTS.HOVER, this.onStarHover.bind(this));
    eventBus.off(STAR_EVENTS.UNHOVER, this.onStarUnhover.bind(this));
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    
    this.hide();
    if (this.labelRenderer && this.labelRenderer.domElement) {
      document.body.removeChild(this.labelRenderer.domElement);
    }
  }
} 