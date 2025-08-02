import * as THREE from 'three';
import { MapModel } from '../../shared/MapModel.js';

/**
 * MapGenerator - Renders space maps using Three.js
 */
export class MapGenerator {
  constructor(scene) {
    this.scene = scene;
    this.stars = [];
    this.wormholes = [];
    this.currentModel = null;
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
    
    // Render the model
    this.renderMap(this.currentModel);
    
    console.log(`Map generated: ${this.currentModel.stars.length} stars, ${this.currentModel.wormholes.length} wormholes`);
  }

  /**
   * Clear all existing map objects
   */
  clearMap() {
    // Remove stars
    this.stars.forEach(star => {
      this.scene.remove(star.mesh);
      star.mesh.geometry.dispose();
      star.mesh.material.dispose();
    });
    
    // Remove wormholes
    this.wormholes.forEach(wormhole => {
      this.scene.remove(wormhole.mesh);
      wormhole.mesh.geometry.dispose();
      wormhole.mesh.material.dispose();
    });
    
    this.stars = [];
    this.wormholes = [];
    this.currentModel = null;
  }

  /**
   * Render a map model using Three.js
   * @param {Object} model - Map model data structure
   */
  renderMap(model) {
    // Render stars
    model.stars.forEach(star => {
      const geometry = new THREE.SphereGeometry(0.1, 16, 16);
      const material = new THREE.MeshPhongMaterial({ 
        color: 0xcccccc,
        shininess: 50
      });
      
      star.mesh = new THREE.Mesh(geometry, material);
      star.mesh.position.set(star.x, star.y, star.z);
      this.scene.add(star.mesh);
      this.stars.push(star);
    });
    
    // Render wormholes
    model.wormholes.forEach(wormhole => {
      const wormholeMesh = this.createWormholeMesh(wormhole.star1, wormhole.star2);
      this.scene.add(wormholeMesh);
      this.wormholes.push({
        mesh: wormholeMesh,
        star1: wormhole.star1,
        star2: wormhole.star2
      });
    });
  }

  /**
   * Create a wormhole mesh between two stars
   * @param {Object} star1 - First star
   * @param {Object} star2 - Second star
   * @returns {THREE.Mesh} Wormhole mesh
   */
  createWormholeMesh(star1, star2) {
    const distance = this.getDistance(star1, star2);
    
    // Create cylinder geometry for wormhole
    const geometry = new THREE.CylinderGeometry(0.02, 0.02, distance, 8);
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
} 