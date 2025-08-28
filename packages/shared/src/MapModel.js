/**
 * MapModel - Data container for space maps
 * Contains no generation logic, only data storage and access methods
 * Map generation is now handled by MapFactory
 */
export class MapModel {
  /**
   * Create a new MapModel instance
   * @param {number} seed - Random seed for deterministic generation
   */
  constructor(seed) {
    this.seed = seed;
    this.starLookup = new Map(); // Fast lookup map for stars by ID
    this.sectors = [];
    this.wormholes = [];
  }

  /**
   * Set the map data from a MapFactory
   * @param {Object} mapData - Map data from MapFactory
   */
  setMapData(mapData) {
    this.sectors = mapData.sectors;
    this.wormholes = mapData.wormholes;
    
    // Populate the lookup map for fast star retrieval
    this.starLookup.clear();
    mapData.stars.forEach(star => {
      this.starLookup.set(star.getId(), star);
    });
  }



  /**
   * Get all stars in the map
   * @returns {Array} Array of all star objects
   */
  getStars() {
    return Array.from(this.starLookup.values());
  }

  /**
   * Get all wormholes in the map
   * @returns {Array} Array of all wormhole objects
   */
  getWormholes() {
    return this.wormholes || [];
  }

  /**
   * Get all sectors in the map
   * @returns {Array} 2D array of sector objects
   */
  getSectors() {
    return this.sectors || [];
  }

  /**
   * Get a star by ID
   * @param {number} id - Star ID
   * @returns {Star|null} Star object or null if not found
   */
  getStarById(id) {
    return this.starLookup.get(id) || null;
  }

} 