import * as THREE from 'three';
import { MapModel, Economy, Ship } from '@loh/shared';
import { StarInteractionManager } from './StarInteractionManager.js';
import { RadialMenu } from './RadialMenu.js';
import { createStarLabel3D } from './scene/createStarLabel3D.js';
import { assetManager } from './engine/AssetManager.js';
import { mem } from './engine/MemoryManager.js';
import { eventBus } from './eventBus.js';
import { VictoryDialog } from './VictoryDialog.js';
import { DefeatDialog } from './DefeatDialog.js';
import { gameStateManager as GSM } from './services/GameStateManager.js';

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
      this.starLookup = new Map(); // Lookup for efficient star access by ID, contains THREE.Group objects
      this.victoryDialog = new VictoryDialog();
      this.defeatDialog = new DefeatDialog();
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
         this.applyAssetsPatch(patch);
   }

   /**
    * Handle game loaded event - renders the game map
    * @param {Object} context - Current system context
    * @param {Object} event - Event data containing game state
    */
   async handleGameLoaded(event)
   {
      console.log('🎨 MapViewGenerator: Game loaded event received:', event);

         this.clearMap();

         // TODO construct the map model from the game info
         this.mapModel = new MapModel(gameInfo.seed);


         // Generate the map from the loaded game data
         await this.generateMapFromModel();

         console.log('🎨 MapViewGenerator: Game map rendered successfully');

         // Check for victory/defeat conditions
         this.checkVictoryConditions(event.details.gameData);
   }

   /**
    * Apply current game state to the static map
    * @param {Object} gameData - Game data containing players, ships, and starStates
    */
   applyCurrentStateToMap(gameData)
   {
      console.log('🎨 MapViewGenerator: Applying current state to map:', gameData);

      const
      {
         players,
         ships,
         starStates
      } = gameData;

      if (!players || !ships || !starStates)
      {
         console.warn('⚠️ MapViewGenerator: Missing required game data for state application');
         return;
      }

      console.log(`⭐ MapViewGenerator: Created global star states lookup with ${starStates.length} stars`);

      // Process star states - assign owners and economies
      starStates.forEach(starState =>
      {
         const star = this.mapModel.getStarById(starState.star_id);
         if (!star)
         {
            console.warn(`⚠️ MapViewGenerator: Star with ID ${starState.star_id} not found in map model`);
            return;
         }

         // Assign owner if present
         if (starState.owner_player)
         {
            const player = players.find(p => p.id === starState.owner_player);
            if (player)
               star.assignOwner(player);
            else
               console.warn(`⚠️ MapViewGenerator: Player with ID ${starState.owner_player} not found`);
         }

         // Assign economy if present
         if (starState.economy !== null)
         {
            const economy = new Economy(starState.economy);
            star.setEconomy(economy);
         }
      });

      // Process ships - create ship instances and place them in stars
      ships.forEach(shipData =>
      {
         const star = this.mapModel.getStarById(shipData.location_star_id);
         if (!star)
         {
            console.warn(`⚠️ MapViewGenerator: Star with ID ${shipData.location_star_id} not found for ship ${shipData.id}`);
            return;
         }

         // Find the owner player
         const owner = players.find(p => p.id === shipData.owner_player);

         // Create ship instance
         const ship = new Ship(
         {
            id: shipData.id,
            power: shipData.power,
            damage: shipData.power - shipData.hp,
            owner: owner,
            location: star
         });

         // Store status property on ship for filtering destroyed ships
         if (shipData.status !== undefined)
            ship.status = shipData.status;

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
               this.scene.remove(star.group);
         });
      }

      // Clear wormholes from scene (they're stored in this.wormholes, not currentModel.wormholes)
      this.wormholes.forEach(wormhole =>
      {
         if (wormhole.mesh)
            this.scene.remove(wormhole.mesh);
      });

      // Clear arrays and lookups
      this.stars.length = 0;
      this.wormholes.length = 0;
      this.sectorBorders.length = 0;
      this.mapModel = null; // Reset MapModel instance

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

      // Hide and dispose dialogs
      if (this.victoryDialog)
      {
         this.victoryDialog.hide();
         this.victoryDialog.dispose();
      }

      if (this.defeatDialog)
      {
         this.defeatDialog.hide();
         this.defeatDialog.dispose();
      }

      this.mapModel = null;
   }

   /**
    * Calculate scaling factors based on canvas size
    * @returns {Object} Object containing star and wormhole radii
    */
   calculateScalingFactors()
   {
      const canvasSize = 2;
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

      // Build stars - base meshes only
      for(const star of GSM.stars)
      {
         let group = this.starLookup.get(star.star_id);

         if (!group)
         {
            group = new THREE.Group();
            group.userData = 
            {
               starId: star.id,
               starRadius: star.owner ? starRadius * 1.25 : starRadius,
               labelMesh: null,
               fleetIcon: null
            };

            mem.track(group, `star-group-${star.id}`);

            const geometry = new THREE.SphereGeometry(group.userData.starRadius, 16, 16);
            const material = new THREE.MeshPhongMaterial(
            {
               color: star.color,
               shininess: 100,
               emissive: new THREE.Color(star.color).multiplyScalar(0.5),
               emissiveIntensity: 0.5
            });

            const mesh = new THREE.Mesh(geometry, material);

            mem.track(mesh, `star-mesh-${star.id}`);

            group.add(mesh);
            group.position.set(star.pos_x, star.pos_y, star.pos_z);

            this.starLookup.set(star.id, {group, mesh});
         }

         if (!this.scene.children.includes(group))
            this.scene.add(group); // this is where the star is added to the map
      }

      // this.buildWormholes(GSM.wormholes, wormholeRadius);

      if (DEBUG_SHOW_SECTOR_BORDERS)
         this.renderSectorBorders(GSM.gameInfo.map_size);

      // Check if font is already loaded and apply 3D labels
      if (this.font)
         this.applyAssetsPatch({ font: this.font });
      else
         console.log('🎨 Font not yet loaded, will apply 3D labels when asset loads');
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

            mem.track(wormholeMesh, `wormhole-${wormhole.star1.id}-${wormhole.star2.id}`);

            this.scene.add(wormholeMesh);
            this.wormholes.push(
            {
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
         this.applyFontPatch(patch.font);

      // Apply rocket patch (create fleet icons)
      if (patch.rocket)
         this.applyRocketPatch(patch.rocket);
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
      this.stars.forEach(star => { this.updateFleetIconForStar(star); });

      console.log('🚀 Rocket model loaded, fleet icons will be created dynamically');
   }

   /**
    * Render sector borders for debugging
    * @param {number} size - Size of the map
    */
   renderSectorBorders(size)
   {
      const sectorSize = 2 / size;
      const points = [];

      for (let i = 0; i <= size; i++)
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
      const material = new THREE.MeshBasicMaterial(
      {
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
      if (!gameData || !gameData.players)
      {
         return;
      }

      const currentPlayerId = eventBus.getContext().playerId; // Use playerId, not user (user is user_id)
      if (!currentPlayerId)
      {
         return;
      }

      console.log('🎨 MapViewGenerator: Checking victory/defeat conditions for player', currentPlayerId);

      // Find current player in the players list
      const currentPlayer = gameData.players.find(p => p.id === currentPlayerId);
      if (!currentPlayer)
      {
         return;
      }

      // Check status
      if (currentPlayer.status === 'winner')
      {
         console.log('🏆 MapViewGenerator: Showing victory dialog for player', currentPlayer);
         this.victoryDialog.show(currentPlayer);
      }
      else if (currentPlayer.status === 'lost')
      {
         console.log('💀 MapViewGenerator: Showing defeat dialog for player', currentPlayer);
         this.defeatDialog.show(currentPlayer);
      }
   }
}