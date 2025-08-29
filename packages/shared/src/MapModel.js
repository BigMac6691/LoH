import { Star } from './Star.js';

/**
 * MapModel - Data container for space maps
 * Contains no generation logic, only data storage and access methods
 * Map generation is now handled by MapFactory
 */
export class MapModel
{
  /**
   * Create a new MapModel instance
   * @param {number} seed - Random seed for deterministic generation
   */
  constructor(seed)
  {
    this.seed = seed;
    this.starLookup = new Map(); // Fast lookup map for stars by ID
    this.sectors = [];
    this.wormholes = [];
  }

  /**
   * Set the map data from a MapFactory
   * @param {Object} mapData - Map data from MapFactory
   */
  setMapData(mapData)
  {
    this.sectors = mapData.sectors;
    this.wormholes = mapData.wormholes;
    
    // Populate the lookup map for fast star retrieval
    this.starLookup.clear();
    mapData.stars.forEach(star =>
    {
      this.starLookup.set(star.getId(), star);
    });
  }

  /**
   * Set stars from plain data objects (e.g., from database)
   * Creates Star instances and adds them to the lookup map
   * @param {Array} starDataArray - Array of plain star data objects
   */
  setStars(starDataArray)
  {
    this.starLookup.clear();
    
    starDataArray.forEach(starData =>
    {
      const star = new Star(starData);
      this.starLookup.set(star.getId(), star);
    });
  }

  /**
   * Set wormholes from plain data objects (e.g., from database)
   * Creates wormhole objects with references to Star instances
   * @param {Array} wormholeDataArray - Array of plain wormhole data objects
   */
  setWormholes(wormholeDataArray)
  {
    this.wormholes = wormholeDataArray.map(wormholeData =>
    {
      // Look up the actual Star instances by ID
      const star1 = this.starLookup.get(wormholeData.star_a_id);
      const star2 = this.starLookup.get(wormholeData.star_b_id);
      
      if (!star1 || !star2)
      {
        console.warn(`Wormhole references non-existent star: ${wormholeData.star_a_id} or ${wormholeData.star_b_id}`);
        return null;
      }
      
      return {
        star1: star1,
        star2: star2
      };
    }).filter(wormhole => wormhole !== null); // Remove any null entries
  }

  /**
   * Build sectors from existing stars (temporary method)
   * Creates a 2D array of sector objects based on star positions
   * @param {number} originalMapSize - Original map size from game creation (required)
   */
  buildSectors(originalMapSize)
  {
    // Fail catastrophically if originalMapSize is missing - this indicates a bug
    if (originalMapSize === null || originalMapSize === undefined)
    {
      console.error('❌ CRITICAL ERROR: buildSectors() called without originalMapSize parameter');
      console.error('This indicates a bug in the calling code - gameInfo.map_size should be available');
      console.error('Calling code should ensure gameInfo is loaded from the backend before calling buildSectors()');
      throw new Error('buildSectors() requires originalMapSize parameter - this indicates a bug in the calling code');
    }
    
    const stars = this.getStars();
    if (stars.length === 0)
    {
      this.sectors = [];
      return;
    }
    
    // Calculate map bounds from star positions
    const bounds = this.calculateMapBounds(stars);
    const mapSize = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    
    // Use the original map size (no fallback - this is the correct value)
    const sectorCount = originalMapSize;
    const sectorSize = mapSize / sectorCount;
    
    // Create sectors array (2D array of sector objects)
    this.sectors = [];
    for (let row = 0; row < sectorCount; row++)
    {
      const sectorRow = [];
      for (let col = 0; col < sectorCount; col++)
      {
        sectorRow.push({
          row,
          col,
          x: bounds.minX + (col * sectorSize) + (sectorSize / 2),
          y: bounds.minY + (row * sectorSize) + (sectorSize / 2),
          width: sectorSize,
          height: sectorSize,
          stars: []
        });
      }
      this.sectors.push(sectorRow);
    }
    
    // Assign stars to sectors
    stars.forEach(star =>
    {
      const sectorX = Math.floor((star.x - bounds.minX) / sectorSize);
      const sectorY = Math.floor((star.y - bounds.minY) / sectorSize);
      
      if (sectorY >= 0 && sectorY < this.sectors.length && 
          sectorX >= 0 && sectorX < this.sectors[sectorY].length)
      {
        this.sectors[sectorY][sectorX].stars.push(star);
      }
    });
  }

  /**
   * Calculate map bounds from star positions
   * @param {Array} stars - Array of star objects
   * @returns {Object} Object with min/max coordinates
   */
  calculateMapBounds(stars)
  {
    if (stars.length === 0)
    {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    stars.forEach(star =>
    {
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
   * Get all stars in the map
   * @returns {Array} Array of all star objects
   */
  getStars()
  {
    return Array.from(this.starLookup.values());
  }

  /**
   * Get all wormholes in the map
   * @returns {Array} Array of all wormhole objects
   */
  getWormholes()
  {
    return this.wormholes || [];
  }

  /**
   * Get all sectors in the map
   * @returns {Array} 2D array of sector objects
   */
  getSectors()
  {
    return this.sectors || [];
  }

  /**
   * Get a star by ID
   * @param {number} id - Star ID
   * @returns {Star|null} Star object or null if not found
   */
  getStarById(id)
  {
    return this.starLookup.get(id) || null;
  }
} 