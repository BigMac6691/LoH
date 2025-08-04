import * as THREE from 'three';

/**
 * StarInteractionManager - Handles star hover detection
 * Simple version that only detects hover over owned stars and logs to console
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
    
    // Mouse move for hover detection - only on canvas
    this.canvas.addEventListener('mousemove', this.onMouseMove);
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
    
    // Check for intersections with stars
    const starMeshes = this.stars.map(star => star.mesh).filter(mesh => mesh);
    const intersects = this.raycaster.intersectObjects(starMeshes, true);
    
    if (intersects.length > 0) {
      const intersectedMesh = intersects[0].object;
      const star = this.stars.find(s => s.mesh === intersectedMesh);
      
      if (star && star !== this.hoveredStar) {
        this.onStarHover(star);
      }
    } else {
      if (this.hoveredStar) {
        this.onStarUnhover();
      }
    }
  }

  /**
   * Handle star hover event
   * @param {Object} star - Star object that was hovered
   */
  onStarHover(star) {
    // Only log if the star is owned by a player
    if (star.isOwned && star.isOwned()) {
      const starName = star.getName ? star.getName() : `Star ${star.id}`;
      console.log(`Hovering over owned star: ${starName}`);
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
    // No update logic needed for simple hover detection
  }

  /**
   * Handle window resize
   */
  onWindowResize() {
    // No resize logic needed for simple hover detection
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Remove event listeners
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this.onMouseMove);
    }
  }
} 