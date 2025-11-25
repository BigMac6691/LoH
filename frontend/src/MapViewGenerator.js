import * as THREE from 'three';
import { MapModel, Economy, Ship } from '@loh/shared';
import { StarInteractionManager } from './StarInteractionManager.js';
import { RadialMenu } from './RadialMenu.js';
import { createStarLabel3D } from './scene/createStarLabel3D.js';
import { assetManager } from './engine/AssetManager.js';
import { mem } from './engine/MemoryManager.js';
import { eventBus } from './eventBus.js';

// Constants for rendering
const DEBUG_SHOW_SECTOR_BORDERS = true; // Set to false to hide sector borders
const STAR_RADIUS_PERCENT = 0.005; // 4% of canvas size
const WORMHOLE_RADIUS_PERCENT = 0.1; // 10% of star radius
const LABEL_VISIBILITY_THRESHOLD = 0.7; // Hide labels when camera distance > 30% of map size

/**
 * MapViewGenerator - Renders space maps using Three.js
 */
export class MapViewGenerator
{
  constructor(scene, camera)
  {
    this.scene = scene;
    this.camera = camera;
    this.stars = [];
    this.wormholes = [];
    this.sectorBorders = [];
    this.mapModel = null;
    this.mapSize = 0; // Track map size for label visibility calculations
    this.starInteractionManager = null;
    this.radialMenu = null;
    this.font = null; // Will be loaded via AssetManager
    this.rocketModel = null; // Will be loaded via AssetManager
    this.starLookup = new Map(); // Lookup for efficient star access by ID
    
    // Set up asset manager event listeners
    this.setupAssetEventListeners();
    
    // Set up game event listeners
    this.setupGameEventListeners();
  }

  /**
   * Set up event listeners for asset manager and game events
   */
  setupAssetEventListeners()
  {
    // Listen for individual asset loads
    assetManager.addEventListener('asset:loaded', (event) =>
    {
      this.onAssetLoaded(event.detail);
    });

    // Listen for all assets ready (optional)
    assetManager.addEventListener('assets:ready', (event) =>
    {
      this.onAssetsReady(event.detail);
    });
  }

  /**
   * Set up event listeners for game events
   */
  setupGameEventListeners()
  {
    // Listen for game loaded events
    eventBus.on('game:gameLoaded', this.handleGameLoaded.bind(this));
  }

  /**
   * Handle individual asset loaded event
   * @param {Object} detail - Event detail { type, path, asset }
   */
  onAssetLoaded(detail)
  {
    const { type, path, asset } = detail;
    console.log(`🎨 Asset loaded: type=${type}, path=${path}`);
    
    // Build patch object from the loaded asset
    const patch = {};
    
    if (type === 'font' || (path && path.includes('font')))
    {
      patch.font = asset;
      this.font = asset; // Store font reference
    }
    else if (path && path.includes('rocket'))
    {
      patch.rocket = asset;
      this.rocketModel = asset; // Store rocket model reference
    }
    
    // Apply the patch if we have a map loaded
    if (Object.keys(patch).length > 0)
    {
      this.applyAssetsPatch(patch);
    }
  }

  /**
   * Handle all assets ready event (optional)
   * @param {Object} detail - Event detail with all loaded assets
   */
  onAssetsReady(detail)
  {
    console.log('🎨 All assets ready:', detail);
    
    // This event is less useful since we handle individual asset loads
    // But we could use it for batch operations if needed
    console.log('🎨 Assets ready event received, but individual assets already processed');
  }

  /**
   * Handle game loaded event - renders the game map
   * @param {Object} context - Current system context
   * @param {Object} eventData - Event data containing game state
   */
  async handleGameLoaded(context, eventData)
  {
    console.log('🎨 MapViewGenerator: Game loaded event received:', eventData);
    console.log('🎨 MapViewGenerator: Context:', context);
    
    try {
      // Check if the event was successful
      if (!eventData.success) {
        console.error('🎨 MapViewGenerator: Game load failed:', eventData.error, eventData.message);
        return;
      }
      
      // Validate that eventData.details has required properties
      if (!eventData.details) {
        throw new Error('eventData.details is missing');
      }
      
      const { gameInfo, stars, wormholes } = eventData.details.gameData;
      
      if (!gameInfo) {
        throw new Error('gameInfo is missing from eventData.details');
      }
      
      if (!stars) {
        throw new Error('stars is missing from eventData.details');
      }
      
      if (!wormholes) {
        throw new Error('wormholes is missing from eventData.details');
      }

      this.clearMap();
      
      // TODO construct the map model from the game info
      this.mapModel = new MapModel(gameInfo.seed);
      window.globalMapModel = this.mapModel; // Set global reference
      const gameData = { stars, wormholes };
      
      // Set map data with stars and wormholes
      this.mapModel.buildSectors(gameInfo.map_size);
      this.mapModel.setStars(stars);
      this.mapModel.setWormholes(wormholes);
      
      // Apply current state to the static map
      this.applyCurrentStateToMap(eventData.details.gameData);
      
      console.log('🎨 MapViewGenerator: Rendering game with data:', gameData);
      
      // Generate the map from the loaded game data
      await this.generateMapFromModel();
      
      console.log('🎨 MapViewGenerator: Game map rendered successfully');
      
      // Check for victory/defeat conditions
      this.checkVictoryConditions(eventData.details.gameData);
      
    } catch (error) {
      console.error('🎨 MapViewGenerator: Error rendering game:', error);
    }
  }

  /**
   * Apply current game state to the static map
   * @param {Object} gameData - Game data containing players, ships, and starStates
   */
  applyCurrentStateToMap(gameData)
  {
    console.log('🎨 MapViewGenerator: Applying current state to map:', gameData);
    
    const { players, ships, starStates } = gameData;
    
    if (!players || !ships || !starStates) {
      console.warn('⚠️ MapViewGenerator: Missing required game data for state application');
      return;
    }
    
    // Create global player lookup Map for easy access by UI classes
    window.globalPlayers = new Map();
    players.forEach(player => {
      window.globalPlayers.set(player.id, player);
    });
    console.log(`👥 MapViewGenerator: Created global player lookup with ${players.length} players`);
    
    // Create global star states lookup Map for easy access by UI classes
    window.globalStarStates = new Map();
    starStates.forEach(starState => {
      window.globalStarStates.set(String(starState.star_id), starState);
    });
    console.log(`⭐ MapViewGenerator: Created global star states lookup with ${starStates.length} stars`);
    
    // Process star states - assign owners and economies
    starStates.forEach(starState => {
      const star = this.mapModel.getStarById(starState.star_id);
      if (!star) {
        console.warn(`⚠️ MapViewGenerator: Star with ID ${starState.star_id} not found in map model`);
        return;
      }
      
      // Assign owner if present
      if (starState.owner_player) {
        const player = players.find(p => p.id === starState.owner_player);
        if (player) {
          star.assignOwner(player);
        } else {
          console.warn(`⚠️ MapViewGenerator: Player with ID ${starState.owner_player} not found`);
        }
      }
      
      // Assign economy if present
      if (starState.economy !== null) {
        const economy = new Economy(starState.economy);
        star.setEconomy(economy);
      }
    });
    
    // Process ships - create ship instances and place them in stars
    ships.forEach(shipData => {
      const star = this.mapModel.getStarById(shipData.location_star_id);
      if (!star) {
        console.warn(`⚠️ MapViewGenerator: Star with ID ${shipData.location_star_id} not found for ship ${shipData.id}`);
        return;
      }
      
      // Find the owner player
      const owner = players.find(p => p.id === shipData.owner_player);
      
      // Create ship instance
      const ship = new Ship({
        id: shipData.id,
        power: shipData.power,
        damage: shipData.power - shipData.hp,
        owner: owner,
        location: star
      });
      
      // Store status property on ship for filtering destroyed ships
      if (shipData.status !== undefined) {
        ship.status = shipData.status;
      }
      
      // Ship is automatically added to star via constructor
    });
    
    console.log(`🎨 MapViewGenerator: Applied state to ${starStates.length} stars and ${ships.length} ships`);
  }

  /**
   * Generate and render a map from existing model data (e.g., from backend)
   * @param {Object|MapModel} mapModel - Map model with stars, wormholes, and config, or MapModel instance
   */
  async generateMapFromModel()
  {
    console.log('Generating map from model data:', this.mapModel);
    
    // Build static map components (stars, wormholes, sectors)
    this.buildStaticMap();
    
    // Initialize star interaction system (now async)
    await this.initializeStarInteraction();
    
    // Position camera to fit the entire map
    this.positionCameraToFitMap();
    
    const starCount = this.mapModel.getStars().length;
    const wormholeCount = this.mapModel.getWormholes().length;
    console.log(`Map generated from model: ${starCount} stars, ${wormholeCount} wormholes`);
  }

  /**
   * Set the font for 3D labels
   * @param {Object} font - Loaded font data from AssetManager
   */
  setFont(font)
  {
    this.font = font;
  }

  /**
   * Clear the current map
   */
  clearMap()
  {
    // Use MemoryManager to dispose all tracked objects
    mem.disposeAll();
    
    // Remove existing objects from scene (MemoryManager handles disposal)
    if (this.mapModel)
    {
      const stars = this.mapModel.getStars();
      stars.forEach(star =>
      {
        if (star.group)
        {
          this.scene.remove(star.group);
        }
      });
    }
    
    // Clear wormholes from scene (they're stored in this.wormholes, not currentModel.wormholes)
    this.wormholes.forEach(wormhole =>
    {
      if (wormhole.mesh)
      {
        this.scene.remove(wormhole.mesh);
      }
    });
    
    // Clear arrays and lookups
    this.stars.length = 0;
    this.wormholes.length = 0;
    this.sectorBorders.length = 0;
    this.starLookup.clear();
    this.mapModel = null; // Reset MapModel instance
    window.globalMapModel = null; // Clear global reference
    
    // Clear star interaction
    if (this.starInteractionManager)
    {
      this.starInteractionManager.dispose();
      this.starInteractionManager = null;
    }
    
    // Clear radial menu
    if (this.radialMenu)
    {
      this.radialMenu.dispose();
      this.radialMenu = null;
    }
    
    this.mapModel = null;
    window.globalMapModel = null; // Clear global reference
  }

  /**
   * Calculate scaling factors based on canvas size
   * @returns {Object} Object containing star and wormhole radii
   */
  calculateScalingFactors()
  {
    const canvasSize = 2;//Math.min(window.innerWidth, window.innerHeight);
    const starRadius = canvasSize * STAR_RADIUS_PERCENT;
    const wormholeRadius = starRadius * WORMHOLE_RADIUS_PERCENT;
    
    return { starRadius, wormholeRadius };
  }

  /**
   * Position camera to fit the entire map in view
   */
  positionCameraToFitMap()
  {
    const fov = this.camera.fov * (Math.PI / 180); // Convert to radians
    const cameraDistance = 1 / Math.tan(fov / 2);
    
    this.camera.position.set(0, 0, cameraDistance * 1.2);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
  }

  /**
   * Build static map components (stars, wormholes, sectors) - no labels or fleet icons
   * @param {Object} model - Map model data structure
   */
  buildStaticMap()
  {
    console.log('Building static map with model:', this.mapModel);

    const { starRadius, wormholeRadius } = this.calculateScalingFactors();
    
    // Create star lookup for efficient access
    this.starLookup = new Map();
    
    const stars = this.mapModel.getStars();
    
    // Build stars - base meshes only
    stars.forEach(star =>
    {
      // Create star group if it doesn't exist
      if (!star.group)
      {
        star.group = new THREE.Group();
        
        // Track the star group with MemoryManager
        mem.track(star.group, `star-group-${star.id}`);
        
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
      if (!star.mesh)
      {
        const geometry = new THREE.SphereGeometry(finalRadius, 16, 16);
        const starColor = star.color || 0xcccccc;
        
        if (isOwned)
        {
          // Enhanced material for owned stars
          const material = new THREE.MeshPhongMaterial({ 
            color: starColor,
            shininess: 100,
            emissive: new THREE.Color(starColor).multiplyScalar(0.5),
            emissiveIntensity: 0.5
          });
          
          star.mesh = new THREE.Mesh(geometry, material);
        }
        else
        {
          // Standard material for unowned stars
          const material = new THREE.MeshPhongMaterial({ 
            color: starColor,
            shininess: 50
          });
          
          star.mesh = new THREE.Mesh(geometry, material);
        }
        
        // Track the star mesh with MemoryManager
        mem.track(star.mesh, `star-mesh-${star.id}`);
        
        // Add star mesh to group
        starGroup.add(star.mesh);
      }
      
      // Position the group at the star's world position
      starGroup.position.set(star.getX(), star.getY(), star.getZ());
      
      // Add group to scene if not already added
      if (!this.scene.children.includes(starGroup))
      {
        this.scene.add(starGroup);
      }
      
      // Add to stars array and lookup
      if (!this.stars.includes(star))
      {
        this.stars.push(star);
      }
      this.starLookup.set(star.id, star);      
    });
    
    const wormholes = this.mapModel.getWormholes();
    const sectors = this.mapModel.getSectors();
    
    console.log('wormhole radius', wormholeRadius);
    // Build wormholes
    this.buildWormholes(wormholes, wormholeRadius);
    
    // Build sector borders if debug mode is enabled
    if (DEBUG_SHOW_SECTOR_BORDERS)
      this.renderSectorBorders(sectors);
    
    // Check if font is already loaded and apply 3D labels
    if (this.font)
    {
      console.log('🎨 Font already loaded, applying 3D labels immediately');
      this.applyAssetsPatch({ font: this.font });
    }
    else
    {
      console.log('🎨 Font not yet loaded, will apply 3D labels when asset loads');
    }
  }

  /**
   * Build wormholes (extracted from buildStaticMap for clarity)
   * @param {Array} wormholes - Array of wormhole data
   * @param {number} wormholeRadius - Radius for wormhole meshes
   */
  buildWormholes(wormholes, wormholeRadius)
  {
    wormholes.forEach(wormhole =>
    {
      // Check if this wormhole already exists
      const existingWormhole = this.wormholes.find(w => 
        (w.star1 === wormhole.star1 && w.star2 === wormhole.star2) ||
        (w.star1 === wormhole.star2 && w.star2 === wormhole.star1)
      );
      
      if (!existingWormhole)
      {
        const wormholeMesh = this.createWormholeMesh(wormhole.star1, wormhole.star2, wormholeRadius);
        
        // Track the wormhole mesh with MemoryManager
        mem.track(wormholeMesh, `wormhole-${wormhole.star1.id}-${wormhole.star2.id}`);
        
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
  applyAssetsPatch(patch)
  {
    if (!this.mapModel || !this.starLookup)
    {
      console.warn('⚠️ Cannot apply assets patch: no map model loaded');
      return;
    }

    console.log('🎨 Applying assets patch:', Object.keys(patch));

    // Apply font patch (create 3D labels)
    if (patch.font)
    {
      this.applyFontPatch(patch.font);
    }

    // Apply rocket patch (create fleet icons)
    if (patch.rocket)
    {
      this.applyRocketPatch(patch.rocket);
    }
  }

  /**
   * Apply font patch to create 3D labels for stars that need them
   * @param {Object} font - Loaded font resource
   */
  applyFontPatch(font)
  {
    // return;
    this.stars.forEach(star =>
    {
      if (star.group && !star.group.userData.labelMesh)
      {
        const starRadius = star.group.userData.starRadius;
        
        try
        {
          const labelMesh = createStarLabel3D(
            star.getName ? star.getName() : `Star ${star.id}`,
            starRadius,
            font
          );
          
          // Track the new label mesh with MemoryManager
          mem.track(labelMesh, `star-label-${star.id}`);
          
          // Store reference in userData
          star.group.userData.labelMesh = labelMesh;
          star.group.add(labelMesh);
          
          // console.log(`📝 Added 3D label to ${star.getName ? star.getName() : `Star ${star.id}`}`);
        }
        catch (error)
        {
          console.warn('⚠️ Failed to create 3D label:', error.message);
        }
      }
    });
  }

  /**
   * Apply rocket patch to create fleet icons for stars with ships
   * @param {Object} rocket - Loaded GLTF resource
   */
  applyRocketPatch(rocket)
  {
    // Store the rocket model reference
    this.rocketModel = rocket;
    
    // Create fleet icons for all stars that have ships
    this.stars.forEach(star =>
    {
      this.updateFleetIconForStar(star);
    });
    
    console.log('🚀 Rocket model loaded, fleet icons will be created dynamically');
  }

  /**
   * Render sector borders for debugging
   * @param {Array} sectors - 2D array of sectors
   */
  renderSectorBorders(sectors)
  {
    const size = sectors.length;
    const sectorSize = 2 / size;
    const points = [];

    for(let i = 0; i <= size; i++)
    {
      points.push(new THREE.Vector3(i * sectorSize - 1, -1, 0));
      points.push(new THREE.Vector3(i * sectorSize - 1, 1, 0));

      points.push(new THREE.Vector3(-1, i * sectorSize - 1, 0));
      points.push(new THREE.Vector3(1, i * sectorSize - 1, 0));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    const grid = new THREE.LineSegments(geometry, material);

    this.scene.add(grid);
  }

  /**
   * Create a wormhole mesh between two stars
   * @param {Object} star1 - First star
   * @param {Object} star2 - Second star
   * @param {number} radius - Wormhole radius
   * @returns {THREE.Mesh} Wormhole mesh
   */
  createWormholeMesh(star1, star2, radius)
  {
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
      x: (star1.getX() + star2.getX()) / 2,
      y: (star1.getY() + star2.getY()) / 2,
      z: (star1.getZ() + star2.getZ()) / 2
    };
    
    wormhole.position.set(midPoint.x, midPoint.y, midPoint.z);
    
    // Orient cylinder to point from star1 to star2
    const direction = new THREE.Vector3(
      star2.getX() - star1.getX(),
      star2.getY() - star1.getY(),
      star2.getZ() - star1.getZ()
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
  getDistance(star1, star2)
  {
    return Math.sqrt(
      Math.pow(star1.getX() - star2.getX(), 2) + 
      Math.pow(star1.getY() - star2.getY(), 2) + 
      Math.pow(star1.getZ() - star2.getZ(), 2)
    );
  }

  /**
   * Update star colors based on player ownership
   * @param {Array} players - Array of player objects
   */
  updateStarColors(players)
  {
    // Reset all stars to light gray and remove glow effects
    this.stars.forEach(star =>
    {
      if (star.mesh && star.mesh.material)
      {
        // Reset to standard material for unowned stars
        star.mesh.material.color.setHex(0xcccccc);
        star.mesh.material.shininess = 50;
        star.mesh.material.emissive = new THREE.Color(0x000000);
        star.mesh.material.emissiveIntensity = 0;
        
        // Remove glow mesh if it exists
        if (star.glowMesh)
        {
          star.mesh.remove(star.glowMesh);
          star.glowMesh = null;
        }
        
        // Reset size to normal
        star.mesh.scale.set(1, 1, 1);
      }
    });

    // Update colors for ALL owned stars (not just main player stars)
    this.stars.forEach(star =>
    {
      if (star.isOwned && star.isOwned() && star.mesh && star.mesh.material)
      {
        // Convert hex color to Three.js color
        const color = new THREE.Color(star.color);
        
        // Update material properties for owned stars
        star.mesh.material.color.copy(color);
        star.mesh.material.shininess = 100;
        star.mesh.material.emissive = color.clone().multiplyScalar(0.5);
        star.mesh.material.emissiveIntensity = 0.5;
        
        // Make owned stars larger (25% larger)
        star.mesh.scale.set(1.25, 1.25, 1.25);        
      }
    });
    
    // CSS2D label color updates no longer needed - using 3D labels
    // this.updateLabelColors(players);
  }

  /**
   * Initialize the CSS2D label renderer
   */
  initializeLabelRenderer()
  {
    if (!this.labelRenderer)
    {
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
   * Create a star name label
   * @param {Object} star - Star object
   * @returns {CSS2DObject} Label object
   */
  createStarLabel(star)
  {
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
    label.position.set(star.getX(), star.getY() - labelOffset, star.getZ());
    
    return label;
  }

  /**
   * Update star groups to face the camera and manage fleet icons
   */
  updateStarGroups()
  {
    this.stars.forEach(star =>
    {
      if (star.group)
      {
        // Copy camera quaternion to make labels and icons face the camera
        star.group.quaternion.copy(this.camera.quaternion);
        
        // Manage fleet icons based on ship presence
        this.updateFleetIconForStar(star);
      }
    });
  }

  /**
   * Update fleet icon for a specific star based on ship presence
   * @param {Object} star - Star object
   */
  updateFleetIconForStar(star)
  {
    if (!star.group) return;
    
    const hasShips = star.hasShips();
    const hasIcon = star.group.userData.fleetIcon;
    
    if (hasShips && !hasIcon)
    {
      // Need to create fleet icon - but only if we have the rocket model
      if (this.rocketModel)
        this.createFleetIconForStar(star);
    }
    else if (!hasShips && hasIcon)
    {
      // Need to remove fleet icon
      this.removeFleetIconFromStar(star);
    }
  }

  /**
   * Create a fleet icon for a specific star
   * @param {Object} star - Star object
   */
  createFleetIconForStar(star)
  {
    if (!star.group || !this.rocketModel) return;
    
    const starRadius = star.group.userData.starRadius;
    
    try
    {
      // Clone the GLTF scene
      const fleetIcon = this.rocketModel.scene.clone();
      
      // Calculate the bounding box to determine the model's size
      const bbox = new THREE.Box3().setFromObject(fleetIcon);
      const modelHeight = bbox.max.y - bbox.min.y;
      
      // Scale the fleet icon to about 2/3 the height of the star
      const targetHeight = starRadius * 2; 
      const scale = targetHeight / modelHeight;
      fleetIcon.scale.set(scale, scale, scale);
      
      // Position to the right of the star (similar to label positioning)
      const iconOffset = starRadius + (targetHeight * 0.7); // Offset to the right
      fleetIcon.position.set(iconOffset, -starRadius, 0);
      
      // Track the new fleet icon with MemoryManager
      mem.track(fleetIcon, `fleet-icon-${star.id}`);
      
      // Store reference in userData
      star.group.userData.fleetIcon = fleetIcon;
      star.group.add(fleetIcon);
      
      console.log(`🚀 Created fleet icon for ${star.getName ? star.getName() : `Star ${star.id}`} (scale: ${scale.toFixed(3)})`);
    }
    catch (error)
    {
      console.warn('⚠️ Failed to create fleet icon:', error.message);
    }
  }

  /**
   * Remove fleet icon from a specific star
   * @param {Object} star - Star object
   */
  removeFleetIconFromStar(star)
  {
    if (!star.group || !star.group.userData.fleetIcon) return;
    
    const fleetIcon = star.group.userData.fleetIcon;
    
    // Remove from group
    star.group.remove(fleetIcon);
    
    // Dispose via MemoryManager
    mem.dispose(fleetIcon);
    
    // Clear reference
    star.group.userData.fleetIcon = null;
    
    console.log(`🚀 Removed fleet icon from ${star.getName ? star.getName() : `Star ${star.id}`}`);
  }

  /**
   * Update label visibility based on camera distance
   */
  updateLabelVisibility()
  {
    if (!this.labelRenderer || !this.mapModel) return;
    
    // Calculate map center
    const mapCenter = new THREE.Vector3(0, 0, 0);
    const cameraDistance = this.camera.position.distanceTo(mapCenter);
    const visibilityThreshold = this.mapSize * LABEL_VISIBILITY_THRESHOLD;
    const shouldShowLabels = cameraDistance <= visibilityThreshold;

    this.starLabels.forEach(label =>
    {
      // Remove or add labels from scene based on visibility
      if (shouldShowLabels)
      {
        // Show labels by adding them back to scene if not already there
        if (!this.scene.children.includes(label))
        {
          this.scene.add(label);
        }
      }
      else
      {
        // Hide labels by removing them from scene
        if (this.scene.children.includes(label))
        {
          this.scene.remove(label);
        }
      }
    });
  }

  /**
   * Update label colors based on player ownership
   * @param {Array} players - Array of player objects
   */
  updateLabelColors(players)
  {
    // Reset all labels to default style
    this.starLabels.forEach(label =>
    {
      if (label.element)
      {
        label.element.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        label.element.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        label.element.style.color = 'white';
        label.element.style.fontWeight = 'normal';
      }
    });
    
    // Update labels for ALL owned stars (not just main player stars)
    this.stars.forEach(star =>
    {
      if (star.isOwned && star.isOwned())
      {
        // Find the label for this star
        const starLabel = this.starLabels.find(label =>
        {
          const labelText = label.element.textContent;
          const starName = star.getName ? star.getName() : `Star ${star.id}`;
          return labelText === starName;
        });
        
        if (starLabel && starLabel.element)
        {
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
  onWindowResize()
  {
    if (this.labelRenderer)
    {
      this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  /**
   * Initialize star interaction system
   */
  async initializeStarInteraction()
  {
    if (this.starInteractionManager)
    {
      this.starInteractionManager.dispose();
    }

    const stars = this.mapModel.getStars();
    
    this.starInteractionManager = new StarInteractionManager(this.scene, this.camera, stars);
    
    // Create radial menu instance
    if (this.radialMenu)
    {
      this.radialMenu.dispose();
    }
    this.radialMenu = new RadialMenu(this.scene, this.camera);
  }

  /**
   * Update star interaction system
   * @param {number} deltaTime - Time since last update
   */
  updateStarInteraction(deltaTime)
  {
    if (this.starInteractionManager)
    {
      this.starInteractionManager.update(deltaTime);
    }
    
    if (this.radialMenu)
    {
      this.radialMenu.update(deltaTime);
    }
    
    // Update star groups to face camera
    this.updateStarGroups();
  }

  /**
   * Handle star interaction resize
   */
  onStarInteractionResize()
  {
    if (this.starInteractionManager)
    {
      this.starInteractionManager.onWindowResize();
    }
    
    if (this.radialMenu)
    {
      this.radialMenu.onWindowResize();
    }
  }

  /**
   * Check for victory/defeat conditions and show appropriate panel
   * @param {Object} gameData - Game data containing players information
   */
  checkVictoryConditions(gameData)
  {
    if (!gameData || !gameData.players) {
      return;
    }

    const currentPlayerId = eventBus.getContext().playerId; // Use playerId, not user (user is user_id)
    if (!currentPlayerId) {
      return;
    }

    console.log('🎨 MapViewGenerator: Checking victory/defeat conditions for player', currentPlayerId);

    // Find current player in the players list
    const currentPlayer = gameData.players.find(p => p.id === currentPlayerId);
    if (!currentPlayer) {
      return;
    }

    // Check status
    if (currentPlayer.status === 'winner') {
      this.showVictoryPanel(currentPlayer);
    } else if (currentPlayer.status === 'lost') {
      this.showDefeatPanel(currentPlayer);
    }
  }

  /**
   * Show victory panel
   * @param {Object} player - Player information
   */
  showVictoryPanel(player)
  {
    console.log('🏆 MapViewGenerator: Showing victory panel for player', player);
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      max-width: 90vw;
      background: rgba(20, 20, 40, 0.98);
      border: 3px solid #ffd700;
      border-radius: 20px;
      box-shadow: 0 0 50px rgba(255, 215, 0, 0.5);
      backdrop-filter: blur(20px);
      z-index: 3000;
      padding: 40px;
      text-align: center;
      font-family: 'Courier New', monospace;
      color: #ffffff;
    `;

    const title = document.createElement('h1');
    title.textContent = '🏆 VICTORY! 🏆';
    title.style.cssText = `
      margin: 0 0 20px 0;
      color: #ffd700;
      font-size: 36px;
      font-weight: bold;
      text-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
    `;

    const message = document.createElement('p');
    message.textContent = `Congratulations ${player.name}! You have conquered the galaxy!`;
    message.style.cssText = `
      margin: 20px 0;
      color: #ffffff;
      font-size: 18px;
      line-height: 1.6;
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'All opponents have been defeated!';
    subtitle.style.cssText = `
      margin: 10px 0 30px 0;
      color: #ffd700;
      font-size: 14px;
      font-style: italic;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      padding: 12px 30px;
      background: rgba(255, 215, 0, 0.2);
      border: 2px solid #ffd700;
      border-radius: 8px;
      color: #ffd700;
      font-family: 'Courier New', monospace;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.3s;
      font-weight: bold;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(255, 215, 0, 0.4)';
      closeButton.style.transform = 'scale(1.05)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(255, 215, 0, 0.2)';
      closeButton.style.transform = 'scale(1)';
    });

    closeButton.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });

    dialog.appendChild(title);
    dialog.appendChild(message);
    dialog.appendChild(subtitle);
    dialog.appendChild(closeButton);

    document.body.appendChild(dialog);
  }

  /**
   * Show defeat panel
   * @param {Object} player - Player information
   */
  showDefeatPanel(player)
  {
    console.log('💀 MapViewGenerator: Showing defeat panel for player', player);
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      max-width: 90vw;
      background: rgba(40, 20, 20, 0.98);
      border: 3px solid #ff4444;
      border-radius: 20px;
      box-shadow: 0 0 50px rgba(255, 68, 68, 0.5);
      backdrop-filter: blur(20px);
      z-index: 3000;
      padding: 40px;
      text-align: center;
      font-family: 'Courier New', monospace;
      color: #ffffff;
    `;

    const title = document.createElement('h1');
    title.textContent = '💀 DEFEAT 💀';
    title.style.cssText = `
      margin: 0 0 20px 0;
      color: #ff4444;
      font-size: 36px;
      font-weight: bold;
      text-shadow: 0 0 20px rgba(255, 68, 68, 0.8);
    `;

    const message = document.createElement('p');
    message.textContent = `Your empire has fallen, ${player.name}.`;
    message.style.cssText = `
      margin: 20px 0;
      color: #ffffff;
      font-size: 18px;
      line-height: 1.6;
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'You no longer control any stars.';
    subtitle.style.cssText = `
      margin: 10px 0 30px 0;
      color: #ff8888;
      font-size: 14px;
      font-style: italic;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      padding: 12px 30px;
      background: rgba(255, 68, 68, 0.2);
      border: 2px solid #ff4444;
      border-radius: 8px;
      color: #ff4444;
      font-family: 'Courier New', monospace;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.3s;
      font-weight: bold;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(255, 68, 68, 0.4)';
      closeButton.style.transform = 'scale(1.05)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(255, 68, 68, 0.2)';
      closeButton.style.transform = 'scale(1)';
    });

    closeButton.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });

    dialog.appendChild(title);
    dialog.appendChild(message);
    dialog.appendChild(subtitle);
    dialog.appendChild(closeButton);

    document.body.appendChild(dialog);
  }
} 