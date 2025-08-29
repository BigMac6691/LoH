import SeededRandom from '../../packages/shared/src/SeededRandom.js';
import { Star } from '../../packages/shared/src/Star.js';
import { getUniqueGeneratedName } from '../../packages/shared/src/starNameGenerator.js';

/**
 * MapFactory - Generates pure data structures for space maps
 * Contains no rendering logic, only data generation
 * Moved from MapModel to separate concerns
 */
export class MapFactory {
  /**
   * Create a new MapFactory instance
   * @param {number} seed - Random seed for deterministic generation
   */
  constructor(seed) {
    this.seededRandom = new SeededRandom(seed);
    this.nextStarId = 0;
  }

  /**
   * Generate a complete map model based on configuration
   * @param {Object} config - Map configuration
   * @param {number} config.mapSize - Grid size (2-9)
   * @param {number} config.minStarDensity - Minimum star density (0-9)
   * @param {number} config.maxStarDensity - Maximum star density (0-9)
   * @returns {Object} Map model data structure
   */
  generateMapModel(config) {
    console.log('Generating map model with config:', config);
    
    // Calculate sector size using normalized coordinates (-1 to +1)
    const sectorSize = 2 / config.mapSize;
    
    // Generate sectors
    this.sectors = this.generateSectors(config.mapSize, sectorSize);
    
    // Generate stars for each sector
    const stars = this.generateStars(config, this.sectors);
    
    // Generate wormholes
    this.wormholes = this.generateWormholes(this.sectors, stars);
    
    return {
      sectors: this.sectors,
      stars,
      wormholes: this.wormholes,
      config,
      stats: {
        sectors: this.sectors.length * this.sectors[0].length,
        stars: stars.length,
        wormholes: this.wormholes.length,
        averageStarsPerSector: stars.length / (this.sectors.length * this.sectors[0].length)
      }
    };
  }

  /**
   * Generate sector grid
   * @param {number} mapSize - Grid size
   * @param {number} sectorSize - Size of each sector
   * @returns {Array} 2D array of sector objects
   */
  generateSectors(mapSize, sectorSize) {
    const sectors = [];
    
    for (let row = 0; row < mapSize; row++) {
      sectors[row] = [];
      for (let col = 0; col < mapSize; col++) {
        sectors[row][col] = {
          row,
          col,
          x: (col * sectorSize) - 1,
          y: (row * sectorSize) - 1,
          width: sectorSize,
          height: sectorSize,
          stars: []
        };
      }
    }
    
    return sectors;
  }

  /**
   * Generate stars for all sectors
   * @param {Object} config - Map configuration
   * @param {Array} sectors - 2D array of sectors
   * @returns {Array} Array of star objects
   */
  generateStars(config, sectors) {
    const stars = [];
    
    for (let row = 0; row < config.mapSize; row++) {
      for (let col = 0; col < config.mapSize; col++) {
        const sector = sectors[row][col];
        const sectorStars = this.generateSectorStars(sector, config);
        
        // Add stars to both sector and global array
        sector.stars = sectorStars;
        stars.push(...sectorStars);
      }
    }
    
    return stars;
  }

  /**
   * Generate stars for a single sector
   * @param {Object} sector - Sector object
   * @param {Object} config - Map configuration
   * @returns {Array} Array of star objects for this sector
   */
  generateSectorStars(sector, config) {
    // Determine number of stars based on density range (use exact values)
    const numStars = this.seededRandom.nextInt(config.minStarDensity, config.maxStarDensity);
    
    const margin = sector.width * 0.05; // 5% margin from edges
    const availableWidth = sector.width - (2 * margin);
    const availableHeight = sector.height - (2 * margin);
    
    const placedStars = [];
    
    for (let i = 0; i < numStars; i++) {
      let attempts = 0;
      let starPlaced = false;
      
      // Try to place star with minimum distance from others
      while (attempts < 50 && !starPlaced) {
        // Calculate position within the sector using normalized coordinates
        const x = sector.x + margin + this.seededRandom.nextFloat(0, availableWidth);
        const y = sector.y + margin + this.seededRandom.nextFloat(0, availableHeight);
        const z = this.seededRandom.nextFloat(-0.01, 0.01); // Random depth in normalized space
        
        // Check distance from existing stars in this sector
        const minDistance = sector.width * 0.1; // 10% of sector width
        let tooClose = false;
        
        for (const existingStar of placedStars) {
          const distance = this.getDistance({ x, y, z }, existingStar.getPosition());
          if (distance < minDistance) {
            tooClose = true;
            break;
          }
        }
        
        if (!tooClose) {
          // Generate a random resource value for this star
          const resourceValue = this.seededRandom.nextInt(0, 100);
          
          const star = new Star({
            star_id: this.nextStarId++,
            name: getUniqueGeneratedName(this.seededRandom), // Generate name here
            pos_x: x,
            pos_y: y,
            pos_z: z,
            sector: { row: sector.row, col: sector.col },
            resource: resourceValue, // Use only the new resource field
            owner: null,
            color: '#CCCCCC', // Default light gray color
            economy: null,
            ships: [],
            connectedStarIds: []
          });
          
          placedStars.push(star);
          starPlaced = true;
        }
        
        attempts++;
      }
    }
    
    return placedStars;
  }

  /**
   * Generate wormholes between stars
   * @param {Array} sectors - 2D array of sectors
   * @param {Array} stars - Array of all stars
   * @returns {Array} Array of wormhole objects
   */
  generateWormholes(sectors, stars) {
    const wormholes = [];
    
    // Connect stars within each sector (chain)
    for (const sector of sectors.flat()) {
      const sectorWormholes = this.connectSectorStars(sector);
      wormholes.push(...sectorWormholes);
    }
    
    // Connect sectors to neighbors
    const sectorWormholes = this.connectAdjacentSectors(sectors);
    wormholes.push(...sectorWormholes);
    
    return wormholes;
  }

  /**
   * Connect stars within a sector in a chain
   * @param {Object} sector - Sector object
   * @returns {Array} Array of wormhole objects
   */
  connectSectorStars(sector) {
    const wormholes = [];
    
    if (sector.stars.length < 2) return wormholes;
    
    const unconnected = [...sector.stars];
    const connected = [];
    
    // Start with first star
    connected.push(unconnected.shift());
    
    // Connect each unconnected star to the closest connected star
    while (unconnected.length > 0) 
    {
      let nearestUnconnectedIndex = 0;
      let nearestConnectedStar = null;
      let nearestDistance = Infinity;
      
      // Find the unconnected star with shortest distance to any connected star
      for (let i = 0; i < unconnected.length; i++) {
        const unconnectedStar = unconnected[i];
        
        // Check distance to each connected star
        for (const connectedStar of connected)
        {
          const distance = this.getDistance(connectedStar.getPosition(), unconnectedStar.getPosition());
          if (distance < nearestDistance)
          {
            nearestDistance = distance;
            nearestUnconnectedIndex = i;
            nearestConnectedStar = connectedStar;
          }
        }
      }
      
      // Connect the nearest unconnected star to its closest connected star
      const nearestStar = unconnected.splice(nearestUnconnectedIndex, 1)[0];
      connected.push(nearestStar);
      
      // Create wormhole
      wormholes.push({
        star1: nearestConnectedStar,
        star2: nearestStar,
        distance: nearestDistance
      });
      
      // Add each star to the other's connected stars list
      nearestConnectedStar.addConnectedStar(nearestStar.getId());
      nearestStar.addConnectedStar(nearestConnectedStar.getId());
    }
    
    return wormholes;
  }

  /**
   * Connect adjacent sectors
   * @param {Array} sectors - 2D array of sectors
   * @returns {Array} Array of wormhole objects
   */
  connectAdjacentSectors(sectors) {
    const wormholes = [];
    const mapSize = sectors.length;
    
    for (let row = 0; row < mapSize; row++) {
      for (let col = 0; col < mapSize; col++) {
        const sector = sectors[row][col];
        
        // Connect to right neighbor
        if (col < mapSize - 1) {
          const rightSector = sectors[row][col + 1];
          const wormhole = this.connectSectors(sector, rightSector);
          if (wormhole) wormholes.push(wormhole);
        }
        
        // Connect to bottom neighbor
        if (row < mapSize - 1) {
          const bottomSector = sectors[row + 1][col];
          const wormhole = this.connectSectors(sector, bottomSector);
          if (wormhole) wormholes.push(wormhole);
        }
      }
    }
    
    return wormholes;
  }

  /**
   * Connect two sectors by connecting their closest stars
   * @param {Object} sector1 - First sector
   * @param {Object} sector2 - Second sector
   * @returns {Object|null} Wormhole object or null if no connection possible
   */
  connectSectors(sector1, sector2) {
    if (sector1.stars.length === 0 || sector2.stars.length === 0) return null;
    
    // Find closest stars between sectors
    let closestPair = null;
    let closestDistance = Infinity;
    
    for (const star1 of sector1.stars) {
      for (const star2 of sector2.stars) {
        const distance = this.getDistance(star1.getPosition(), star2.getPosition());
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPair = [star1, star2];
        }
      }
    }
    
    if (closestPair) {
      // Add each star to the other's connected stars list
      closestPair[0].addConnectedStar(closestPair[1].getId());
      closestPair[1].addConnectedStar(closestPair[0].getId());
      
      return {
        star1: closestPair[0],
        star2: closestPair[1],
        distance: closestDistance
      };
    }
    
    return null;
  }



  /**
   * Calculate distance between two positions
   * @param {Object} pos1 - First position {x, y, z}
   * @param {Object} pos2 - Second position {x, y, z}
   * @returns {number} Distance
   */
  getDistance(pos1, pos2)
  {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) + 
      Math.pow(pos1.y - pos2.y, 2) + 
      Math.pow(pos1.z - pos2.z, 2)
    );
  }
}

/**
 * Generate a deterministic map based on seed and configuration
 * This function provides the same interface as the old mapGenerator.js
 * but uses MapFactory internally for better structure
 * @param {Object} params
 * @param {string|number} params.seed - Random seed for deterministic generation
 * @param {number} params.mapSize - Grid size (2-9)
 * @param {number} params.densityMin - Minimum star density (0-9)
 * @param {number} params.densityMax - Maximum star density (0-9)
 * @returns {MapModel} MapModel instance with generated data
 */
export async function generateMap({ seed, mapSize, densityMin, densityMax }) {
  // Convert string seed to number if needed
  const numericSeed = typeof seed === 'string' ? hashString(seed) : seed;
  
  // Create MapFactory instance
  const mapFactory = new MapFactory(numericSeed);
  
  // Generate the map model
  const model = mapFactory.generateMapModel({
    mapSize,
    minStarDensity: densityMin,
    maxStarDensity: densityMax
  });
  
  // Create and return MapModel instance
  const { MapModel } = await import('../../packages/shared/src/MapModel.js');
  const mapModel = new MapModel(numericSeed);
  mapModel.setMapData(model);
  
  return mapModel;
}



/**
 * Hash a string to a number for seeding
 * @param {string} str - String to hash
 * @returns {number} Hash value
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
