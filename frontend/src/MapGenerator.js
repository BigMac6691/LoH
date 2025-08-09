import * as THREE from 'three';
// import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'; // No longer needed
import { MapModel } from '../../shared/MapModel.js';
import { StarInteractionManager } from './StarInteractionManager.js';
import { RadialMenu } from './RadialMenu.js';
import { createStarLabel3D } from './scene/createStarLabel3D.js';
import { assetManager } from './engine/AssetManager.js';

// Constants for rendering
const DEBUG_SHOW_SECTOR_BORDERS = true; // Set to false to hide sector borders
const STAR_RADIUS_PERCENT = 0.005; // 4% of canvas size
const WORMHOLE_RADIUS_PERCENT = 0.1; // 10% of star radius
const LABEL_VISIBILITY_THRESHOLD = 0.7; // Hide labels when camera distance > 30% of map size

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
    // this.labelRenderer = null; // No longer needed - using 3D labels
    // this.starLabels = []; // No longer needed - using 3D labels
    this.mapSize = 0; // Track map size for label visibility calculations
    this.starInteractionManager = null;
    this.radialMenu = null;
    this.font = null; // Will be loaded via AssetManager
    this.starLookup = new Map(); // Lookup for efficient star access by ID
    
    // Set up asset manager event listeners
    this.setupAssetEventListeners();
  }

  /**
   * Set up event listeners for asset manager
   */
  setupAssetEventListeners() {
    // Listen for individual asset loads
    assetManager.addEventListener('asset:loaded', (event) => {
      this.onAssetLoaded(event.detail);
    });

    // Listen for all assets ready (optional)
    assetManager.addEventListener('assets:ready', (event) => {
      this.onAssetsReady(event.detail);
    });
  }

  /**
   * Handle individual asset loaded event
   * @param {Object} detail - Event detail { type, path, asset }
   */
  onAssetLoaded(detail) {
    const { type, path, asset } = detail;
    console.log(`🎨 Asset loaded: type=${type}, path=${path}`);
    
    // Build patch object from the loaded asset
    const patch = {};
    
    if (type === 'font' || (path && path.includes('font'))) {
      patch.font = asset;
      this.font = asset; // Store font reference
    } else if (path && path.includes('rocket')) {
      patch.rocket = asset;
    }
    
    // Apply the patch if we have a map loaded
    if (Object.keys(patch).length > 0) {
      this.applyAssetsPatch(patch);
    }
  }

  /**
   * Handle all assets ready event (optional)
   * @param {Object} detail - Event detail with all loaded assets
   */
  onAssetsReady(detail) {
    console.log('🎨 All assets ready:', detail);
    
    // This event is less useful since we handle individual asset loads
    // But we could use it for batch operations if needed
    console.log('🎨 Assets ready event received, but individual assets already processed');
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
    
    // CSS2D label renderer no longer needed - using 3D labels
    // this.initializeLabelRenderer();
    
    // Build static map components (stars, wormholes, sectors)
    this.buildStaticMap(this.currentModel);
    
    // Initialize star interaction system
    this.initializeStarInteraction();
    
    // Position camera to fit the entire map
    this.positionCameraToFitMap();
    
    console.log(`Map generated: ${this.currentModel.stars.length} stars, ${this.currentModel.wormholes.length} wormholes`);
  }

  /**
   * Set the font for 3D labels
   * @param {Object} font - Loaded font data from AssetManager
   */
  setFont(font) {
    this.font = font;
  }

  /**
   * Clear the current map
   */
  clearMap() {
    // Remove existing objects
    if (this.currentModel) {
      this.currentModel.stars.forEach(star => {
        // Clean up star group and its contents
        if (star.group) {
          // Dispose of 3D labels and fleet icons
          if (star.group.userData.labelMesh) {
            this.disposeLabelMesh(star.group.userData.labelMesh);
          }
          if (star.group.userData.fleetIcon) {
            this.disposeFleetIcon(star.group.userData.fleetIcon);
          }
          
          // Remove the entire star group
          this.scene.remove(star.group);
        }
      });
      
      this.currentModel.wormholes.forEach(wormhole => {
        if (wormhole.mesh) {
          this.scene.remove(wormhole.mesh);
        }
      });
    }
    
    // Clear arrays and lookups
    this.stars.length = 0;
    this.wormholes.length = 0;
    this.sectorBorders.length = 0;
    // this.starLabels.length = 0; // No longer needed - using 3D labels
    this.starLookup.clear();
    
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
   * Build static map components (stars, wormholes, sectors) - no labels or fleet icons
   * @param {Object} model - Map model data structure
   */
  buildStaticMap(model) {
    const { starRadius, wormholeRadius } = this.calculateScalingFactors();
    
    // Create star lookup for efficient access
    this.starLookup = new Map();
    
    // Build stars - base meshes only
    model.stars.forEach(star => {
      // Create star group if it doesn't exist
      if (!star.group) {
        star.group = new THREE.Group();
        
        // Store references in userData for easy access
        star.group.userData = {
          starId: star.id,
          starRadius: starRadius,
          labelMesh: null,
          fleetIcon: null
        };
      }
      
      const starGroup = star.group;
      const isOwned = star.isOwned && star.isOwned();
      const finalRadius = isOwned ? starRadius * 1.25 : starRadius;
      
      // Update userData with current radius
      starGroup.userData.starRadius = finalRadius;
      
      // Create star mesh if it doesn't exist
      if (!star.mesh) {
        const geometry = new THREE.SphereGeometry(finalRadius, 16, 16);
        const starColor = star.color || 0xcccccc;
        
        if (isOwned) {
          // Enhanced material for owned stars
          const material = new THREE.MeshPhongMaterial({ 
            color: starColor,
            shininess: 100,
            emissive: new THREE.Color(starColor).multiplyScalar(0.5),
            emissiveIntensity: 0.5
          });
          
          star.mesh = new THREE.Mesh(geometry, material);
          
          // Add glow effect for owned stars
          const glowGeometry = new THREE.SphereGeometry(finalRadius * 1.4, 16, 16);
          const glowMaterial = new THREE.MeshBasicMaterial({
            color: starColor,
            transparent: true,
            opacity: 0.6,
            side: THREE.BackSide
          });
          const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
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
        
        // Add star mesh to group
        starGroup.add(star.mesh);
      }
      
      // Position the group at the star's world position
      starGroup.position.set(star.x, star.y, star.z);
      
      // Add group to scene if not already added
      if (!this.scene.children.includes(starGroup)) {
        this.scene.add(starGroup);
      }
      
      // Add to stars array and lookup
      if (!this.stars.includes(star)) {
        this.stars.push(star);
      }
      this.starLookup.set(star.id, star);
      
      // CSS2D labels disabled - using 3D labels instead
      // if (!star.css2dLabel) {
      //   const starLabel = this.createStarLabel(star);
      //   star.css2dLabel = starLabel;
      //   this.scene.add(starLabel);
      //   this.starLabels.push(starLabel);
      // }
    });
    
    // Build wormholes
    this.buildWormholes(model.wormholes, wormholeRadius);
    
    // Build sector borders if debug mode is enabled
    if (DEBUG_SHOW_SECTOR_BORDERS) {
      this.renderSectorBorders(model.sectors);
    }
    
    // Check if font is already loaded and apply 3D labels
    if (this.font) {
      console.log('🎨 Font already loaded, applying 3D labels immediately');
      this.applyAssetsPatch({ font: this.font });
    } else {
      console.log('🎨 Font not yet loaded, will apply 3D labels when asset loads');
    }
  }

  /**
   * Build wormholes (extracted from buildStaticMap for clarity)
   * @param {Array} wormholes - Array of wormhole data
   * @param {number} wormholeRadius - Radius for wormhole meshes
   */
  buildWormholes(wormholes, wormholeRadius) {
    wormholes.forEach(wormhole => {
      // Check if this wormhole already exists
      const existingWormhole = this.wormholes.find(w => 
        (w.star1 === wormhole.star1 && w.star2 === wormhole.star2) ||
        (w.star1 === wormhole.star2 && w.star2 === wormhole.star1)
      );
      
      if (!existingWormhole) {
        const wormholeMesh = this.createWormholeMesh(wormhole.star1, wormhole.star2, wormholeRadius);
        this.scene.add(wormholeMesh);
        this.wormholes.push({
          mesh: wormholeMesh,
          star1: wormhole.star1,
          star2: wormhole.star2
        });
      }
    });
  }

  /**
   * Apply assets patch to add labels and fleet icons based on loaded assets
   * @param {Object} patch - Asset patch object { font?, rocket? }
   */
  applyAssetsPatch(patch) {
    if (!this.currentModel || !this.starLookup) {
      console.warn('⚠️ Cannot apply assets patch: no map model loaded');
      return;
    }

    console.log('🎨 Applying assets patch:', Object.keys(patch));

    // Apply font patch (create 3D labels)
    if (patch.font) {
      this.applyFontPatch(patch.font);
    }

    // Apply rocket patch (create fleet icons)
    if (patch.rocket) {
      this.applyRocketPatch(patch.rocket);
    }
  }

  /**
   * Apply font patch to create 3D labels for stars that need them
   * @param {Object} font - Loaded font resource
   */
  applyFontPatch(font) {
    this.stars.forEach(star => {
      if (star.group && !star.group.userData.labelMesh) {
        const starRadius = star.group.userData.starRadius;
        
        try {
          const labelMesh = createStarLabel3D(
            star.getName ? star.getName() : `Star ${star.id}`,
            starRadius,
            font
          );
          
          // Store reference in userData
          star.group.userData.labelMesh = labelMesh;
          star.group.add(labelMesh);
          
          // console.log(`📝 Added 3D label to ${star.getName ? star.getName() : `Star ${star.id}`}`);
        } catch (error) {
          console.warn('⚠️ Failed to create 3D label:', error.message);
        }
      }
    });
  }

  /**
   * Apply rocket patch to create fleet icons for stars with ships
   * @param {Object} rocket - Loaded GLTF resource
   */
  applyRocketPatch(rocket) {
    this.stars.forEach(star => {
      const hasShips = star.hasShips && star.hasShips();
      const hasIcon = star.group && star.group.userData.fleetIcon;
      
      if (hasShips && !hasIcon && star.group) {
        const starRadius = star.group.userData.starRadius;
        
        try {
          // Clone the GLTF scene
          const fleetIcon = rocket.scene.clone();
          
          // Position with existing static world offsets
          const iconOffset = starRadius + 8; // Offset to the right
          const iconY = starRadius * 0.5; // Half the star's height
          fleetIcon.position.set(iconOffset, iconY, 0);
          
          // Store reference in userData
          star.group.userData.fleetIcon = fleetIcon;
          star.group.add(fleetIcon);
          
          console.log(`🚀 Added fleet icon to ${star.getName ? star.getName() : `Star ${star.id}`}`);
        } catch (error) {
          console.warn('⚠️ Failed to create fleet icon:', error.message);
        }
      }
    });
  }

  /**
   * Clean up and dispose of a 3D label mesh
   * @param {THREE.Mesh} labelMesh - Label mesh to dispose
   */
  disposeLabelMesh(labelMesh) {
    if (labelMesh) {
      if (labelMesh.geometry) {
        labelMesh.geometry.dispose();
      }
      if (labelMesh.material) {
        if (Array.isArray(labelMesh.material)) {
          labelMesh.material.forEach(material => material.dispose());
        } else {
          labelMesh.material.dispose();
        }
      }
    }
  }

  /**
   * Clean up and dispose of a fleet icon (GLTF clone)
   * @param {THREE.Object3D} fleetIcon - Fleet icon to dispose
   */
  disposeFleetIcon(fleetIcon) {
    if (fleetIcon) {
      fleetIcon.traverse((child) => {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
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

    // Update colors for ALL owned stars (not just main player stars)
    this.stars.forEach(star => {
      if (star.isOwned && star.isOwned() && star.mesh && star.mesh.material) {
        // Convert hex color to Three.js color
        const color = new THREE.Color(star.color);
        
        // Update material properties for owned stars
        star.mesh.material.color.copy(color);
        star.mesh.material.shininess = 100;
        star.mesh.material.emissive = color.clone().multiplyScalar(0.5);
        star.mesh.material.emissiveIntensity = 0.5;
        
        // Make owned stars larger (25% larger)
        star.mesh.scale.set(1.25, 1.25, 1.25);
        
        // Add glow effect if it doesn't exist
        if (!star.glowMesh) {
          const glowGeometry = new THREE.SphereGeometry(1.4, 16, 16);
          const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6,
            side: THREE.BackSide
          });
          const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
          glowMesh.position.set(0, 0, 0);
          star.mesh.add(glowMesh);
          star.glowMesh = glowMesh;
        } else {
          // Update existing glow mesh color and properties
          star.glowMesh.material.color.copy(color);
          star.glowMesh.material.opacity = 0.6;
        }
      }
    });
    
    // CSS2D label color updates no longer needed - using 3D labels
    // this.updateLabelColors(players);
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
   * Create a fleet icon mesh (positioned relative to star group)
   * @param {number} starRadius - Radius of the star for positioning
   * @returns {THREE.Mesh} Fleet icon mesh
   */
  createFleetIconMesh(starRadius) {
    // Create a cone geometry for the fleet icon
    const coneGeometry = new THREE.ConeGeometry(2, 6, 8);
    
    // Use a bright color for visibility
    const iconMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00, // Bright green
      transparent: true,
      opacity: 0.9
    });
    
    const icon = new THREE.Mesh(coneGeometry, iconMaterial);
    
    // Position icon to the right of the star, at half the star's height
    const iconOffset = starRadius + 8; // Offset to the right
    const iconY = starRadius * 0.5; // Half the star's height
    
    icon.position.set(iconOffset, iconY, 0);
    
    // Rotate the cone so the base is in the x-z plane and the point extends along the y-axis
    icon.rotation.z = Math.PI / 2;
    
    return icon;
  }

  /**
   * Update star groups to face the camera (per-frame updates only)
   */
  updateStarGroups() {
    this.stars.forEach(star => {
      if (star.group) {
        // Copy camera quaternion to make labels and icons face the camera
        star.group.quaternion.copy(this.camera.quaternion);
        
        // Update fleet icon visibility based on ships (no creation/removal here)
        if (star.group.userData.fleetIcon) {
          const hasShips = star.hasShips && star.hasShips();
          star.group.userData.fleetIcon.visible = hasShips;
        }
      }
    });
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
   * Render labels (no longer needed - using 3D labels)
   */
  renderLabels() {
    // CSS2D labels disabled - using 3D labels instead
    // if (this.labelRenderer && this.currentModel) {
    //   this.updateLabelVisibility();
    //   this.labelRenderer.render(this.scene, this.camera);
    // }
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
        label.element.style.fontWeight = 'normal';
      }
    });
    
    // Update labels for ALL owned stars (not just main player stars)
    this.stars.forEach(star => {
      if (star.isOwned && star.isOwned()) {
        // Find the label for this star
        const starLabel = this.starLabels.find(label => {
          const labelText = label.element.textContent;
          const starName = star.getName ? star.getName() : `Star ${star.id}`;
          return labelText === starName;
        });
        
        if (starLabel && starLabel.element) {
          // Update label with owner color
          starLabel.element.style.backgroundColor = star.color + 'CC'; // Add transparency
          starLabel.element.style.borderColor = star.color;
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
    
    // Update star groups to face camera
    this.updateStarGroups();
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