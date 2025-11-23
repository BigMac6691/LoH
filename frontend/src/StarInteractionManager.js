import * as THREE from 'three';
import { eventBus, STAR_EVENTS } from './eventBus.js';

/**
 * StarInteractionManager - Handles star hover detection and emits events
 */
export class StarInteractionManager {
  constructor(scene, camera, stars) {
    this.scene = scene;
    this.camera = camera;
    this.stars = stars;
    
    // Interaction state
    this.hoveredStar = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Get canvas element for event listeners
    this.canvas = document.getElementById('gameCanvas');
    
    // Hover area configuration
    this.hoverRadius = 80; // Larger radius for easier menu interaction
    
    // Initialize
    this.initialize();
  }

  /**
   * Initialize the interaction manager
   */
  initialize() {
    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up mouse event listeners
   */
  setupEventListeners() {
    // Bind event handlers to this instance
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    
    // Mouse move for hover detection - only on canvas
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mouseleave', this.onMouseLeave);
  }

  /**
   * Handle mouse movement for star hover detection
   * @param {MouseEvent} event - Mouse event
   */
  onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Check for intersections with stars (now using groups)
    const starGroups = this.stars.map(star => star.group).filter(group => group);
    const intersects = this.raycaster.intersectObjects(starGroups, true);
    
    // Debug logging
    if (intersects.length > 0) {
      console.log('🎯 StarInteractionManager: Found intersection with', intersects.length, 'objects');
      const intersectedObject = intersects[0].object;
      // Find the star by checking if the intersected object is part of a star's group
      const star = this.stars.find(s => s.group && s.group.children.includes(intersectedObject));
      
      if (star && star !== this.hoveredStar) {
        console.log('🎯 StarInteractionManager: Found star', star);
        this.onStarHover(star);
      }
    } else {
      // Check if mouse is still within hover area of current star
      if (this.hoveredStar && !this.isMouseInHoverArea(event)) {
        this.onStarUnhover();
      }
    }
  }

  /**
   * Handle mouse leave from canvas
   * @param {MouseEvent} event - Mouse event
   */
  onMouseLeave(event) {
    if (this.hoveredStar) {
      this.onStarUnhover();
    }
  }

  /**
   * Check if mouse is within the hover area of the current star
   * @param {MouseEvent} event - Mouse event
   * @returns {boolean} True if mouse is in hover area
   */
  isMouseInHoverArea(event) {
    if (!this.hoveredStar || !this.hoveredStar.group) {
      return false;
    }

    // Get star's screen position (using group position)
    const starPosition = this.hoveredStar.group.position.clone();
    starPosition.project(this.camera);
    
    // Convert to screen coordinates
    const starScreenX = (starPosition.x + 1) * window.innerWidth / 2;
    const starScreenY = (-starPosition.y + 1) * window.innerHeight / 2;
    
    // Calculate distance from mouse to star center
    const distance = Math.sqrt(
      Math.pow(event.clientX - starScreenX, 2) + 
      Math.pow(event.clientY - starScreenY, 2)
    );
    
    // Check if within hover radius
    return distance <= this.hoverRadius;
  }

  /**
   * Handle star hover event
   * @param {Object} star - Star object that was hovered
   */
  onStarHover(star) {
    // Only emit event for owned stars
    if (star.isOwned && star.isOwned()) {
      console.log(`Hovering over owned star:`, star);
      
      // Emit star hover event
      eventBus.emit(STAR_EVENTS.HOVER, {
        star: star,
        position: star.group.position
      });
    }
    
    this.hoveredStar = star;
  }

  /**
   * Handle star unhover event
   */
  onStarUnhover() {
    if (this.hoveredStar && this.hoveredStar.isOwned && this.hoveredStar.isOwned()) {
      const starName = this.hoveredStar.getName ? this.hoveredStar.getName() : `Star ${this.hoveredStar.id}`;
      console.log(`No longer hovering over: ${starName}`);
      
      // Emit star unhover event
      eventBus.emit(STAR_EVENTS.UNHOVER, {
        star: this.hoveredStar
      });
    }
    
    this.hoveredStar = null;
  }



  /**
   * Update star list
   * @param {Array} stars - New star array
   */
  updateStars(stars) {
    this.stars = stars;
  }

  /**
   * Update interaction manager
   * @param {number} deltaTime - Time since last update
   */
  update(deltaTime) {
    // No direct radial menu updates needed
  }

  /**
   * Handle window resize
   */
  onWindowResize() {
    // No direct radial menu resize needed
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Remove event listeners
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this.onMouseMove);
      this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
    }
  }
} 