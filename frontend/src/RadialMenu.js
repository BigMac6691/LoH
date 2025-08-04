import * as THREE from 'three';
import { eventBus, STAR_EVENTS } from './eventBus.js';

/**
 * RadialMenu - Displays a radial context menu for star interactions using Three.js meshes
 */
export class RadialMenu {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.menuGroup = null;
    this.currentStar = null;
    this.isVisible = false;
    
    // Menu configuration
    this.menuRadius = 10; // World space radius - increased for visibility
    this.iconSize = 5; // World space size - increased for visibility
    this.animationDuration = 200; // ms
    this.hoverRadius = 12; // World space hover radius - increased for visibility
    
    // Raycasting for icon interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Icon tracking
    this.icons = [];
    this.hoveredIcon = null;
    
    // Hover boundary circle
    this.hoverCircle = null;
    
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
    
    // Add click detection for icons
    document.addEventListener('click', this.onClick.bind(this));
  }

  /**
   * Handle mouse movement for hover area detection
   * @param {MouseEvent} event - Mouse event
   */
  onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Check for icon intersections
    this.checkIconHover();
    
    // Check if we should hide the menu when mouse leaves hover area
    if (this.isVisible && !this.isMouseInHoverArea()) {
      this.hide();
    }
  }

  /**
   * Check for icon hover using raycasting
   */
  checkIconHover() {
    if (!this.isVisible || !this.menuGroup) return;
    
    // Get all icon meshes
    const iconMeshes = this.icons.map(icon => icon.mesh);
    const intersects = this.raycaster.intersectObjects(iconMeshes, true);
    
    if (intersects.length > 0) {
      const intersectedMesh = intersects[0].object;
      const icon = this.icons.find(icon => icon.mesh === intersectedMesh);
      
      if (icon && icon !== this.hoveredIcon) {
        this.onIconHover(icon);
      }
    } else {
      if (this.hoveredIcon) {
        this.onIconUnhover();
      }
    }
  }

  /**
   * Handle icon hover
   * @param {Object} icon - Icon object
   */
  onIconHover(icon) {
    this.hoveredIcon = icon;
    
    // Scale up the icon
    icon.mesh.scale.setScalar(1.2);
    
    // Change material color
    if (icon.material) {
      icon.material.color.setHex(0x00ff88);
    }
  }

  /**
   * Handle icon unhover
   */
  onIconUnhover() {
    if (this.hoveredIcon) {
      // Scale down the icon
      this.hoveredIcon.mesh.scale.setScalar(1.0);
      
      // Reset material color
      if (this.hoveredIcon.material) {
        this.hoveredIcon.material.color.setHex(0xffffff);
      }
      
      this.hoveredIcon = null;
    }
  }

  /**
   * Check if mouse is within the hover area
   * @returns {boolean} True if mouse is in hover area
   */
  isMouseInHoverArea() {
    if (!this.menuGroup) return false;
    
    // Get mouse position in world space at menu depth
    const menuPosition = this.menuGroup.position;
    const distance = menuPosition.distanceTo(this.camera.position);
    
    // Create a ray from camera through mouse
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const mouseWorldPosition = new THREE.Vector3();
    mouseWorldPosition.copy(this.camera.position).add(
      this.raycaster.ray.direction.clone().multiplyScalar(distance)
    );
    
    // Calculate distance from mouse to menu center
    const distanceToMenu = mouseWorldPosition.distanceTo(menuPosition);
    
    return distanceToMenu <= this.hoverRadius;
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
    if (!this.isVisible || !this.menuGroup) return;
    
    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Check for icon intersections
    const iconMeshes = this.icons.map(icon => icon.mesh);
    const intersects = this.raycaster.intersectObjects(iconMeshes, true);
    
    if (intersects.length > 0) {
      const intersectedMesh = intersects[0].object;
      const icon = this.icons.find(icon => icon.mesh === intersectedMesh);
      
      if (icon && icon.onClick) {
        icon.onClick();
      }
    }
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

    // Create menu group
    this.menuGroup = new THREE.Group();
    this.scene.add(this.menuGroup);
    
    console.log('🎯 RadialMenu: Added menu group to scene. Scene children count:', this.scene.children.length);

    // Create hover boundary circle
    this.createHoverCircle();

    // Create industry icon
    const industryIcon = this.createIcon('🏭', 'Industry', 0, () => {
      const starName = star.getName ? star.getName() : `Star ${star.id}`;
      console.log(`${starName} - industry`);
    });
    
    // Create a simple colored sphere as alternative icon
    const sphereGeometry = new THREE.SphereGeometry(2, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const sphereIcon = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphereIcon.position.set(0, 0, 2); // Between test sphere and hover circle
    this.menuGroup.add(sphereIcon);
    console.log('🎯 RadialMenu: Added green sphere as alternative icon');
    
    // Create a simple test sphere to verify positioning
    const testGeometry = new THREE.SphereGeometry(2, 16, 16);
    const testMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const testSphere = new THREE.Mesh(testGeometry, testMaterial);
    testSphere.position.set(0, 0, 8); // Above the menu
    this.menuGroup.add(testSphere);
    console.log('🎯 RadialMenu: Added test sphere for debugging');

    // Position the menu group at the star's position
    this.menuGroup.position.copy(position);
    this.menuGroup.add(industryIcon.mesh);

    console.log('🎯 RadialMenu: Menu group created with icon at:', this.menuGroup.position);

    // Orient menu to face camera
    this.updateMenuOrientation();

    // Animate the menu appearance
    this.animateIn();
  }

  /**
   * Create hover boundary circle
   */
  createHoverCircle() {
    // Create circle geometry with thicker ring
    const circleGeometry = new THREE.RingGeometry(this.hoverRadius - 1, this.hoverRadius + 1, 32);
    
    // Create material for the circle with higher opacity
    const circleMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    
    // Create mesh
    this.hoverCircle = new THREE.Mesh(circleGeometry, circleMaterial);
    this.hoverCircle.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    this.hoverCircle.position.z = -0.5; // Slightly below the icons
    
    console.log('🎯 RadialMenu: Created hover circle with radius:', this.hoverRadius);
    this.menuGroup.add(this.hoverCircle);
  }

  /**
   * Create a menu icon using Three.js mesh
   * @param {string} symbol - Icon symbol/emoji
   * @param {string} tooltip - Tooltip text
   * @param {number} angle - Angle in radians
   * @param {Function} onClick - Click handler
   * @returns {Object} Icon object with mesh and metadata
   */
  createIcon(symbol, tooltip, angle, onClick) {
    // Create a plane geometry for the icon
    const geometry = new THREE.PlaneGeometry(this.iconSize, this.iconSize);
    
    // Create a canvas to render the emoji
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 128;
    
    // Set up canvas with better contrast
    context.fillStyle = 'rgba(0, 0, 0, 0.9)';
    context.fillRect(0, 0, 128, 128);
    
    // Draw border
    context.strokeStyle = '#00ff88';
    context.lineWidth = 8;
    context.strokeRect(4, 4, 120, 120);
    
    // Draw emoji with larger font
    context.font = '80px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(symbol, 64, 64);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Create material
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide
    });
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position the icon around the circle
    const radius = this.menuRadius;
    mesh.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      1 // Higher above the hover circle for visibility
    );
    
    console.log('🎯 RadialMenu: Created icon at position:', mesh.position);
    
    // Store icon data
    const icon = {
      mesh: mesh,
      material: material,
      geometry: geometry,
      texture: texture,
      symbol: symbol,
      tooltip: tooltip,
      onClick: onClick,
      angle: angle
    };
    
    // Add click handler
    mesh.userData = { icon: icon };
    
    this.icons.push(icon);
    
    return icon;
  }

  /**
   * Update menu orientation to face camera
   */
  updateMenuOrientation() {
    if (!this.menuGroup) return;
    
    // Make menu group face camera directly
    this.menuGroup.lookAt(this.camera.position);
    
    console.log('🎯 RadialMenu: Updated menu orientation, menu group position:', this.menuGroup.position);
  }

  /**
   * Animate the menu appearance
   */
  animateIn() {
    if (!this.menuGroup) return;

    this.icons.forEach((icon, index) => {
      const delay = index * 50; // Stagger the animations
      
      // Start with scale 0
      icon.mesh.scale.setScalar(0);
      
      setTimeout(() => {
        // Animate to scale 1
        const startScale = 0;
        const endScale = 1;
        const duration = 200;
        const startTime = Date.now();
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Easing function
          const easeOutBack = 1 + 2.70158 * Math.pow(progress - 1, 3) + 1.70158 * Math.pow(progress - 1, 2);
          const scale = startScale + (endScale - startScale) * easeOutBack;
          
          icon.mesh.scale.setScalar(scale);
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };
        
        animate();
      }, delay);
    });
  }

  /**
   * Animate the menu disappearance
   */
  animateOut() {
    if (!this.menuGroup) return;

    this.icons.forEach((icon) => {
      // Animate to scale 0
      const startScale = 1;
      const endScale = 0;
      const duration = 150;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const easeInBack = progress * progress * (2.70158 * progress - 1.70158);
        const scale = startScale + (endScale - startScale) * easeInBack;
        
        icon.mesh.scale.setScalar(scale);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
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
      
      // Clean up icons
      this.icons.forEach(icon => {
        if (icon.geometry) icon.geometry.dispose();
        if (icon.material) icon.material.dispose();
        if (icon.texture) icon.texture.dispose();
      });
      this.icons = [];
      
      this.isVisible = false;
      this.currentStar = null;
      this.hoveredIcon = null;
    }, this.animationDuration);
  }

  /**
   * Update the menu (called each frame)
   * @param {number} deltaTime - Time since last update
   */
  update(deltaTime) {
    // Update menu orientation to face camera
    if (this.isVisible) {
      this.updateMenuOrientation();
    }
  }

  /**
   * Handle window resize
   */
  onWindowResize() {
    // No specific resize handling needed for mesh-based menu
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
    
    this.hide();
  }
} 