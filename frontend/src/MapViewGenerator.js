import * as THREE from 'three';
import { MapModel, Economy, Ship } from '@loh/shared';
import { StarInteractionManager } from './StarInteractionManager.js';
import { RadialMenu } from './RadialMenu.js';
import { createStarLabel3D } from './scene/createStarLabel3D.js';
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
      this.sectorBorders = [];
      this.mapModel = null;
      this.mapSize = 0; // Track map size for label visibility calculations
      this.starInteractionManager = null;
      this.radialMenu = null;
      this.font = null; // Will be loaded via AssetManager
      this.rocketModel = null; // Will be loaded via AssetManager
      this.wormholes = new Map(); // Lookup for efficient wormhole access by ID, contains THREE.Mesh objects
      this.starLookup = new Map(); // Lookup for efficient star access by ID, contains THREE.Group objects
      this.victoryDialog = new VictoryDialog();
      this.defeatDialog = new DefeatDialog();
   }

   /**
    * Handle game loaded event - renders the game map
    * @param {Object} context - Current system context
    * @param {Object} event - Event data containing game state
    */
   handleGameLoaded(event)
   {
      console.log('🎨 MapViewGenerator: Game loaded event received:', event);

         this.clearMap();

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

      const { players, ships, starStates } = gameData;

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
   }

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
      const starRadius = 2 * STAR_RADIUS_PERCENT;
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

   buildStaticMap()
   {
      const { starRadius, wormholeRadius } = this.calculateScalingFactors();

      this.buildStars(starRadius);
      this.buildWormholes(wormholeRadius);

      if (DEBUG_SHOW_SECTOR_BORDERS)
         this.renderSectorBorders(GSM.gameInfo.map_size);

      if (this.font)
         this.buildStarLabels();
   }

   buildStars(starRadius)
   {
      for (const star of GSM.stars)
      {
         if (this.starLookup.has(star.star_id))
            continue;
         else
         {
            const group = new THREE.Group();
            group.userData = 
            {
               starId: star.star_id,
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

            this.starLookup.set(star.star_id, {group, mesh});  // mesh is the star, group are things attached to the star like labels and icons
            this.scene.add(group);
         }
      }
   }

   /**
    * Build wormholes (extracted from buildStaticMap for clarity)
    * @param {number} radius - Radius for wormhole meshes
    */
   buildWormholes(radius)
   {
      for (const wormhole of GSM.wormholes)
      {
         const star1 = GSM.getStarByStarId(wormhole.star_a_id);
         const star2 = GSM.getStarByStarId(wormhole.star_b_id);

         if (this.wormholes.has(wormhole.wormhole_id))
            continue;
         else
         {
            const distance = this.getDistance(star1, star2);

            const geometry = new THREE.CylinderGeometry(radius, radius, distance, 8);
            const material = new THREE.MeshBasicMaterial(
            {
               color: 0x444444,
               transparent: true,
               opacity: 0.6
            });

            const mesh = new THREE.Mesh(geometry, material);

            // Position and orient the wormhole
            const midPoint = 
            {
               x: (star1.pos_x + star2.pos_x) / 2,
               y: (star1.pos_y + star2.pos_y) / 2,
               z: (star1.pos_z + star2.pos_z) / 2
            };

            mesh.position.set(midPoint.x, midPoint.y, midPoint.z);

            // Orient cylinder to point from star1 to star2
            const direction = new THREE.Vector3(
               star2.pos_x - star1.pos_x,
               star2.pos_y - star1.pos_y,
               star2.pos_z - star1.pos_z
            );

            const up = new THREE.Vector3(0, 1, 0);
            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(up, direction.normalize());
            mesh.setRotationFromQuaternion(quaternion);

            mem.track(mesh, `wormhole-${star1.id}-${star2.id}`);

            this.wormholes.set(wormhole.wormhole_id, mesh);
            this.scene.add(mesh); // this is where the wormhole is added to the map
         }
      }
   }

   /**
    * This is the initial build of the star labels, it should only be called once after the font is loaded
    */
   buildStarLabels()
   {
      for(const [starId, starView] of this.starLookup.entries())
      {
         const labelMesh = createStarLabel3D(
            GSM.getStarByStarId(starId).name,
            starView.group.userData.starRadius,
            this.font
         );

         mem.track(labelMesh, `star-label-${starId}`);

         starView.group.userData.labelMesh = labelMesh;
         starView.group.add(labelMesh);
      }
   }

   /**
    * Apply rocket patch to create fleet icons for stars with ships
    * @param {Object} rocket - Loaded GLTF resource
    */
   updateFleetIcons()
   {
      for(const starView of this.starLookup.values())
         this.updateFleetIconForStar(starView);
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
    * Calculate distance between two stars
    * @param {Object} star1 - First star
    * @param {Object} star2 - Second star
    * @returns {number} Distance
    */
   getDistance(star1, star2)
   {
      return Math.sqrt(
         Math.pow(star1.pos_x - star2.pos_x, 2) +
         Math.pow(star1.pos_y - star2.pos_y, 2) +
         Math.pow(star1.pos_z - star2.pos_z, 2)
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
   updateFleetIconForStar(starView)
   {
      const hasShips = GSM.getStarByStarId(starView.group.userData.starId).ships.length > 0;
      const hasIcon = starView.group.userData.fleetIcon;

      if (hasShips && !hasIcon)
      {
         if (this.rocketModel)
            this.createFleetIconForStar(starView);
      }
      else if (!hasShips && hasIcon)
         this.removeFleetIconFromStar(starView);
   }

   /**
    * Create a fleet icon for a specific star
    * @param {Object} star - Star object
    */
   createFleetIconForStar(starView)
   {
      const starRadius = starView.group.userData.starRadius;
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
      mem.track(fleetIcon, `fleet-icon-${starView.group.userData.starId}`);

      // Store reference in userData
      starView.group.userData.fleetIcon = fleetIcon;
      starView.group.add(fleetIcon);
   }

   /**
    * Remove fleet icon from a specific star
    * @param {Object} star - Star object
    */
   removeFleetIconFromStar(starView)
   {
      if (!starView.group || !starView.group.userData.fleetIcon) 
         return;

      const fleetIcon = starView.group.userData.fleetIcon;

      // Remove from group
      starView.group.remove(fleetIcon);

      // Dispose via MemoryManager
      mem.dispose(fleetIcon);

      // Clear reference
      starView.group.userData.fleetIcon = null;

      console.log(`🚀 Removed fleet icon from ${GSM.getStarByStarId(starView.group.userData.starId).name}`);
   }

   async initializeStarInteraction()
   {
      if (this.starInteractionManager)
         this.starInteractionManager.dispose();

      const stars = this.mapModel.getStars();

      this.starInteractionManager = new StarInteractionManager(this.scene, this.camera, stars);

      if (this.radialMenu)
         this.radialMenu.dispose();

      this.radialMenu = new RadialMenu(this.scene, this.camera);
   }

   /**
    * Update star interaction system
    * @param {number} deltaTime - Time since last update
    */
   updateStarInteraction(deltaTime)
   {
      if (this.starInteractionManager)
         this.starInteractionManager.update(deltaTime);

      if (this.radialMenu)
         this.radialMenu.update(deltaTime);

      // Update star groups to face camera
      this.updateStarGroups();
   }

   /**
    * Handle star interaction resize
    */
   onStarInteractionResize()
   {
      if (this.starInteractionManager)
         this.starInteractionManager.onWindowResize();

      if (this.radialMenu)
         this.radialMenu.onWindowResize();
   }

   /**
    * Check for victory/defeat conditions and show appropriate panel
    * @param {Object} gameData - Game data containing players information
    */
   checkVictoryConditions(gameData)
   {
      console.log('🎨 MapViewGenerator: Checking victory/defeat conditions for player', GSM.currentPlayerId);

      const currentPlayer = gameData.players.find(p => p.id === GSM.currentPlayerId);
 
      if (currentPlayer.status === 'winner')
         this.victoryDialog.show(currentPlayer);
      else if (currentPlayer.status === 'lost')
         this.defeatDialog.show(currentPlayer);
   }
}