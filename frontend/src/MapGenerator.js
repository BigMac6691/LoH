import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { MapModel } from '../../shared/MapModel.js';
import { StarInteractionManager } from './StarInteractionManager.js';
import { RadialMenu } from './RadialMenu.js';

// Constants for rendering
const DEBUG_SHOW_SECTOR_BORDERS = true; // Set to false to hide sector borders
const STAR_RADIUS_PERCENT = 0.005; // 4% of canvas size
const WORMHOLE_RADIUS_PERCENT = 0.1; // 10% of star radius
const LABEL_VISIBILITY_THRESHOLD = 0.3; // Hide labels when camera distance > 30% of map size

/**
 * MapGenerator - Renders space maps using Three.js
 */
export class MapGenerator {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.stars = [];
    this.wormholes = [];
    this.sectorBorders = [];
    this.currentModel = null;
    this.labelRenderer = null;
    this.starLabels = [];
    this.mapSize = 0; // Track map size for label visibility calculations
    this.starInteractionManager = null;
    this.radialMenu = null;
  }

  /**
   * Generate and render a complete map based on configuration
   * @param {Object} config - Map configuration
   * @param {number} config.mapSize - Grid size (2-9)
   * @param {number} config.minStarDensity - Minimum star density (0-9)
   * @param {number} config.maxStarDensity - Maximum star density (0-9)
   * @param {number} config.seed - Random seed
   */
  generateMap(config) {
    console.log('Generating map with config:', config);
    
    // Clear existing map
    this.clearMap();
    
    // Generate map model using MapModel class
    const mapModel = new MapModel(config.seed);
    this.currentModel = mapModel.generateMapModel(config);
    
    // Calculate map size for label visibility
    this.calculateMapSize();
    
    // Initialize label renderer if not already done
    this.initializeLabelRenderer();
    
    // Render the model
    this.renderMap(this.currentModel);
    
    // Initialize star interaction system
    this.initializeStarInteraction();
    
    // Position camera to fit the entire map
    this.positionCameraToFitMap();
    
    console.log(`Map generated: ${this.currentModel.stars.length} stars, ${this.currentModel.wormholes.length} wormholes`);
  }

  /**
   * Clear the current map
   */
  clearMap() {
    // Remove existing objects
    if (this.currentModel) {
      this.currentModel.stars.forEach(star => {
        if (star.mesh) {
          this.scene.remove(star.mesh);
        }
      });
      
      this.currentModel.wormholes.forEach(wormhole => {
        if (wormhole.mesh) {
          this.scene.remove(wormhole.mesh);
        }
      });
    }
    
    // Clear star interaction
    if (this.starInteractionManager) {
      this.starInteractionManager.dispose();
      this.starInteractionManager = null;
    }
    
    // Clear radial menu
    if (this.radialMenu) {
      this.radialMenu.dispose();
      this.radialMenu = null;
    }
    
    this.currentModel = null;
  }

  /**
   * Calculate scaling factors based on canvas size
   * @returns {Object} Object containing star and wormhole radii
   */
  calculateScalingFactors() {
    const canvasSize = Math.min(window.innerWidth, window.innerHeight);
    const starRadius = canvasSize * STAR_RADIUS_PERCENT;
    const wormholeRadius = starRadius * WORMHOLE_RADIUS_PERCENT;
    
    return { starRadius, wormholeRadius };
  }

  /**
   * Position camera to fit the entire map in view
   */
  positionCameraToFitMap() {
    if (!this.currentModel || !this.currentModel.sectors.length) return;
    
    // Calculate map bounds
    const bounds = this.calculateMapBounds();
    
    // Calculate required camera distance
    const mapWidth = bounds.maxX - bounds.minX;
    const mapHeight = bounds.maxY - bounds.minY;
    const mapDepth = bounds.maxZ - bounds.minZ;
    
    const maxDimension = Math.max(mapWidth, mapHeight, mapDepth);
    const fov = this.camera.fov * (Math.PI / 180); // Convert to radians
    const cameraDistance = (maxDimension / 2) / Math.tan(fov / 2);
    
    // Position camera
    const centerX = (bounds.maxX + bounds.minX) / 2;
    const centerY = (bounds.maxY + bounds.minY) / 2;
    const centerZ = (bounds.maxZ + bounds.minZ) / 2;
    
    this.camera.position.set(centerX, centerY, centerZ + cameraDistance * 1.2);
    this.camera.lookAt(centerX, centerY, centerZ);
    this.camera.updateMatrixWorld();
  }

  /**
   * Calculate the bounds of the current map
   * @returns {Object} Object with min/max coordinates
   */
  calculateMapBounds() {
    if (!this.currentModel || !this.currentModel.stars.length) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    this.currentModel.stars.forEach(star => {
      minX = Math.min(minX, star.x);
      maxX = Math.max(maxX, star.x);
      minY = Math.min(minY, star.y);
      maxY = Math.max(maxY, star.y);
      minZ = Math.min(minZ, star.z);
      maxZ = Math.max(maxZ, star.z);
    });
    
    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  /**
   * Render a map model using Three.js
   * @param {Object} model - Map model data structure
   */
  renderMap(model) {
    const { starRadius, wormholeRadius } = this.calculateScalingFactors();
    
    // Render stars
    model.stars.forEach(star => {
             // Make owned stars larger for better visibility
       const isOwned = star.isOwned && star.isOwned();
       const finalRadius = isOwned ? starRadius * 1.25 : starRadius;
      const geometry = new THREE.SphereGeometry(finalRadius, 16, 16);
      
      // Use player color if star is owned, otherwise use light gray
      const starColor = star.color || 0xcccccc;
      
      if (isOwned) {
                 // Enhanced material for owned stars - brighter and more prominent
         const material = new THREE.MeshPhongMaterial({ 
           color: starColor,
           shininess: 100,
           emissive: new THREE.Color(starColor).multiplyScalar(0.5), // Brighter glow effect
           emissiveIntensity: 0.5
         });
        
        star.mesh = new THREE.Mesh(geometry, material);
        
                 // Add a more visible glow effect for owned stars
         const glowGeometry = new THREE.SphereGeometry(finalRadius * 1.4, 16, 16);
         const glowMaterial = new THREE.MeshBasicMaterial({
           color: starColor,
           transparent: true,
           opacity: 0.6,
           side: THREE.BackSide // Render on the back side for better glow effect
         });
         const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
         glowMesh.position.set(0, 0, 0); // Ensure it's centered on the star
         star.mesh.add(glowMesh);
         star.glowMesh = glowMesh;
      } else {
        // Standard material for unowned stars
        const material = new THREE.MeshPhongMaterial({ 
          color: starColor,
          shininess: 50
        });
        
        star.mesh = new THREE.Mesh(geometry, material);
      }
      
             star.mesh.position.set(star.x, star.y, star.z);
       this.scene.add(star.mesh);
       this.stars.push(star);
       
       // Create and add star label
       const starLabel = this.createStarLabel(star);
       this.scene.add(starLabel);
       this.starLabels.push(starLabel);
     });
    
    // Render wormholes
    model.wormholes.forEach(wormhole => {
      const wormholeMesh = this.createWormholeMesh(wormhole.star1, wormhole.star2, wormholeRadius);
      this.scene.add(wormholeMesh);
      this.wormholes.push({
        mesh: wormholeMesh,
        star1: wormhole.star1,
        star2: wormhole.star2
      });
    });
    
    // Render sector borders if debug mode is enabled
    if (DEBUG_SHOW_SECTOR_BORDERS) {
      this.renderSectorBorders(model.sectors);
    }
  }

  /**
   * Render sector borders for debugging
   * @param {Array} sectors - 2D array of sectors
   */
  renderSectorBorders(sectors) {
    const borderMaterial = new THREE.LineBasicMaterial({ 
      color: 0x00ff00, 
      transparent: true, 
      opacity: 0.3 
    });
    
    sectors.forEach(row => {
      row.forEach(sector => {
        const borderGeometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
          // Bottom face
          sector.x - sector.width/2, sector.y - sector.height/2, -2,
          sector.x + sector.width/2, sector.y - sector.height/2, -2,
          sector.x + sector.width/2, sector.y + sector.height/2, -2,
          sector.x - sector.width/2, sector.y + sector.height/2, -2,
          sector.x - sector.width/2, sector.y - sector.height/2, -2,
          
          // Top face
          sector.x - sector.width/2, sector.y - sector.height/2, 2,
          sector.x + sector.width/2, sector.y - sector.height/2, 2,
          sector.x + sector.width/2, sector.y + sector.height/2, 2,
          sector.x - sector.width/2, sector.y + sector.height/2, 2,
          sector.x - sector.width/2, sector.y - sector.height/2, 2,
          
          // Connecting lines
          sector.x - sector.width/2, sector.y - sector.height/2, -2,
          sector.x - sector.width/2, sector.y - sector.height/2, 2,
          
          sector.x + sector.width/2, sector.y - sector.height/2, -2,
          sector.x + sector.width/2, sector.y - sector.height/2, 2,
          
          sector.x + sector.width/2, sector.y + sector.height/2, -2,
          sector.x + sector.width/2, sector.y + sector.height/2, 2,
          
          sector.x - sector.width/2, sector.y + sector.height/2, -2,
          sector.x - sector.width/2, sector.y + sector.height/2, 2
        ]);
        
        borderGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        this.scene.add(border);
        this.sectorBorders.push(border);
      });
    });
  }

  /**
   * Create a wormhole mesh between two stars
   * @param {Object} star1 - First star
   * @param {Object} star2 - Second star
   * @param {number} radius - Wormhole radius
   * @returns {THREE.Mesh} Wormhole mesh
   */
  createWormholeMesh(star1, star2, radius) {
    const distance = this.getDistance(star1, star2);
    
    // Create cylinder geometry for wormhole
    const geometry = new THREE.CylinderGeometry(radius, radius, distance, 8);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x444444,
      transparent: true,
      opacity: 0.6
    });
    
    const wormhole = new THREE.Mesh(geometry, material);
    
    // Position and orient the wormhole
    const midPoint = {
      x: (star1.x + star2.x) / 2,
      y: (star1.y + star2.y) / 2,
      z: (star1.z + star2.z) / 2
    };
    
    wormhole.position.set(midPoint.x, midPoint.y, midPoint.z);
    
    // Orient cylinder to point from star1 to star2
    const direction = new THREE.Vector3(
      star2.x - star1.x,
      star2.y - star1.y,
      star2.z - star1.z
    );
    
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, direction.normalize());
    wormhole.setRotationFromQuaternion(quaternion);
    
    return wormhole;
  }

  /**
   * Calculate distance between two stars
   * @param {Object} star1 - First star
   * @param {Object} star2 - Second star
   * @returns {number} Distance
   */
  getDistance(star1, star2) {
    return Math.sqrt(
      Math.pow(star1.x - star2.x, 2) + 
      Math.pow(star1.y - star2.y, 2) + 
      Math.pow(star1.z - star2.z, 2)
    );
  }

  /**
   * Get map statistics
   * @returns {Object} Map statistics
   */
  getStats() {
    if (!this.currentModel) {
      return {
        sectors: 0,
        stars: 0,
        wormholes: 0,
        averageStarsPerSector: 0
      };
    }
    
    return this.currentModel.stats;
  }

    /**
   * Update star colors based on player ownership
   * @param {Array} players - Array of player objects
   */
  updateStarColors(players) {
    // Reset all stars to light gray and remove glow effects
    this.stars.forEach(star => {
      if (star.mesh && star.mesh.material) {
        // Reset to standard material for unowned stars
        star.mesh.material.color.setHex(0xcccccc);
        star.mesh.material.shininess = 50;
        star.mesh.material.emissive = new THREE.Color(0x000000);
        star.mesh.material.emissiveIntensity = 0;
        
        // Remove glow mesh if it exists
        if (star.glowMesh) {
          star.mesh.remove(star.glowMesh);
          star.glowMesh = null;
        }
        
        // Reset size to normal
        star.mesh.scale.set(1, 1, 1);
      }
    });

    // Color stars based on player ownership
    players.forEach(player => {
      if (player.star && player.star.mesh && player.star.mesh.material) {
        // Convert hex color to Three.js color
        const color = new THREE.Color(player.color);
        
        // Update material properties for owned stars
        player.star.mesh.material.color.copy(color);
        player.star.mesh.material.shininess = 100;
        player.star.mesh.material.emissive = color.clone().multiplyScalar(0.5);
        player.star.mesh.material.emissiveIntensity = 0.5;
        
        // Make owned stars larger (25% larger)
        player.star.mesh.scale.set(1.25, 1.25, 1.25);
        
        // Add glow effect if it doesn't exist
        if (!player.star.glowMesh) {
          const glowGeometry = new THREE.SphereGeometry(1.4, 16, 16);
          const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6,
            side: THREE.BackSide
          });
          const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
          glowMesh.position.set(0, 0, 0);
          player.star.mesh.add(glowMesh);
          player.star.glowMesh = glowMesh;
        } else {
          // Update existing glow mesh color and properties
          player.star.glowMesh.material.color.copy(color);
          player.star.glowMesh.material.opacity = 0.6;
        }
      }
    });
    
    // Update label colors for owned stars
    this.updateLabelColors(players);
  }

  /**
   * Initialize the CSS2D label renderer
   */
  initializeLabelRenderer() {
    if (!this.labelRenderer) {
      this.labelRenderer = new CSS2DRenderer();
      this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
      this.labelRenderer.domElement.style.position = 'absolute';
      this.labelRenderer.domElement.style.top = '0px';
      this.labelRenderer.domElement.style.pointerEvents = 'none';
      this.labelRenderer.domElement.style.zIndex = '1000';
      
      // Add the label renderer to the DOM
      document.body.appendChild(this.labelRenderer.domElement);
    }
  }

  /**
   * Calculate the map size for label visibility calculations
   */
  calculateMapSize() {
    if (!this.currentModel || !this.currentModel.stars.length) {
      this.mapSize = 0;
      return;
    }
    
    const bounds = this.calculateMapBounds();
    const mapWidth = bounds.maxX - bounds.minX;
    const mapHeight = bounds.maxY - bounds.minY;
    const mapDepth = bounds.maxZ - bounds.minZ;
    
    this.mapSize = Math.max(mapWidth, mapHeight, mapDepth);
  }

  /**
   * Create a star name label
   * @param {Object} star - Star object
   * @returns {CSS2DObject} Label object
   */
  createStarLabel(star) {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'star-label';
    labelDiv.textContent = star.getName ? star.getName() : `Star ${star.id}`;
    labelDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    labelDiv.style.color = 'white';
    labelDiv.style.padding = '3px 8px';
    labelDiv.style.borderRadius = '4px';
    labelDiv.style.fontSize = '11px';
    labelDiv.style.fontFamily = 'Arial, sans-serif';
    labelDiv.style.whiteSpace = 'nowrap';
    labelDiv.style.pointerEvents = 'none';
    labelDiv.style.userSelect = 'none';
    labelDiv.style.transform = 'translate(-50%, 0)'; // Center horizontally
    labelDiv.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    
    const label = new CSS2DObject(labelDiv);
    
    // Calculate the star's radius for proper label positioning
    const { starRadius } = this.calculateScalingFactors();
    const isOwned = star.isOwned && star.isOwned();
    const finalRadius = isOwned ? starRadius * 1.25 : starRadius;
    
    // Position label below the star using the star's radius as offset
    const labelOffset = finalRadius + 0.2; // Star radius + small gap
    label.position.set(star.x, star.y - labelOffset, star.z);
    
    return label;
  }

  /**
   * Update label visibility based on camera distance
   */
  updateLabelVisibility() {
    if (!this.labelRenderer || !this.currentModel) return;
    
    // Calculate map center
    const bounds = this.calculateMapBounds();
    const mapCenter = new THREE.Vector3(
      (bounds.maxX + bounds.minX) / 2,
      (bounds.maxY + bounds.minY) / 2,
      (bounds.maxZ + bounds.minZ) / 2
    );
    
    const cameraDistance = this.camera.position.distanceTo(mapCenter);
    const visibilityThreshold = this.mapSize * LABEL_VISIBILITY_THRESHOLD;
    const shouldShowLabels = cameraDistance <= visibilityThreshold;

    this.starLabels.forEach(label => {
      // Remove or add labels from scene based on visibility
      if (shouldShowLabels) {
        // Show labels by adding them back to scene if not already there
        if (!this.scene.children.includes(label)) {
          this.scene.add(label);
        }
      } else {
        // Hide labels by removing them from scene
        if (this.scene.children.includes(label)) {
          this.scene.remove(label);
        }
      }
    });
  }

  /**
   * Render labels (call this after the main render)
   */
  renderLabels() {
    if (this.labelRenderer && this.currentModel) {
      this.updateLabelVisibility();
      this.labelRenderer.render(this.scene, this.camera);
    }
  }

  /**
   * Update label colors based on player ownership
   * @param {Array} players - Array of player objects
   */
  updateLabelColors(players) {
    // Reset all labels to default style
    this.starLabels.forEach(label => {
      if (label.element) {
        label.element.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        label.element.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        label.element.style.color = 'white';
      }
    });
    
    // Update labels for owned stars
    players.forEach(player => {
      if (player.star) {
        // Find the label for this star
        const starLabel = this.starLabels.find(label => {
          const labelText = label.element.textContent;
          const starName = player.star.getName ? player.star.getName() : `Star ${player.star.id}`;
          return labelText === starName;
        });
        
        if (starLabel && starLabel.element) {
          // Update label with player color
          starLabel.element.style.backgroundColor = player.color + 'CC'; // Add transparency
          starLabel.element.style.borderColor = player.color;
          starLabel.element.style.color = 'white';
          starLabel.element.style.fontWeight = 'bold';
        }
      }
    });
  }

  /**
   * Handle window resize for label renderer
   */
  onWindowResize() {
    if (this.labelRenderer) {
      this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  /**
   * Initialize star interaction system
   */
  initializeStarInteraction() {
    if (this.starInteractionManager) {
      this.starInteractionManager.dispose();
    }
    
    this.starInteractionManager = new StarInteractionManager(
      this.scene, 
      this.camera, 
      this.currentModel.stars
    );
    
    // Create radial menu instance
    if (this.radialMenu) {
      this.radialMenu.dispose();
    }
    this.radialMenu = new RadialMenu(this.scene, this.camera);
  }

  /**
   * Update star interaction system
   * @param {number} deltaTime - Time since last update
   */
  updateStarInteraction(deltaTime) {
    if (this.starInteractionManager) {
      this.starInteractionManager.update(deltaTime);
    }
    
    if (this.radialMenu) {
      this.radialMenu.update(deltaTime);
    }
  }

  /**
   * Handle star interaction resize
   */
  onStarInteractionResize() {
    if (this.starInteractionManager) {
      this.starInteractionManager.onWindowResize();
    }
    
    if (this.radialMenu) {
      this.radialMenu.onWindowResize();
    }
  }



  /**
   * Get the current map model
   * @returns {Object|null} Current map model or null
   */
  getCurrentModel() {
    return this.currentModel;
  }
} 