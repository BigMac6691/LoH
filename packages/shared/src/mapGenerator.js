import SeededRandom from './SeededRandom.js';
import { generateStarName } from './starNameGenerator.js';

/**
 * Generate a deterministic map based on seed and configuration
 * @param {Object} params
 * @param {string|number} params.seed - Random seed for deterministic generation
 * @param {number} params.mapSize - Grid size (2-9)
 * @param {number} params.densityMin - Minimum star density (0-9)
 * @param {number} params.densityMax - Maximum star density (0-9)
 * @returns {Object} Map data with stars, edges, and suggested player placements
 */
export function generateMap({ seed, mapSize, densityMin, densityMax }) {
  const random = new SeededRandom(typeof seed === 'string' ? hashString(seed) : seed);
  
  // Generate sectors
  const sectors = generateSectors(mapSize);
  
  // Generate stars for each sector
  const stars = generateStars(sectors, densityMin, densityMax, random);
  
  // Generate edges (wormholes) between stars
  const edges = generateEdges(sectors, stars, random);
  
  // Generate suggested player placements
  const suggestedPlayers = generateSuggestedPlayerPlacements(sectors, stars, random);
  
  return {
    stars,
    edges,
    suggestedPlayers
  };
}

/**
 * Generate sector grid
 * @param {number} mapSize - Grid size
 * @returns {Array} 2D array of sector objects
 */
function generateSectors(mapSize) {
  const sectors = [];
  
  for (let row = 0; row < mapSize; row++) {
    sectors[row] = [];
    for (let col = 0; col < mapSize; col++) {
      sectors[row][col] = {
        row,
        col,
        sectorX: col,
        sectorY: row,
        stars: []
      };
    }
  }
  
  return sectors;
}

/**
 * Generate stars for all sectors
 * @param {Array} sectors - 2D array of sectors
 * @param {number} densityMin - Minimum star density
 * @param {number} densityMax - Maximum star density
 * @param {SeededRandom} random - Random number generator
 * @returns {Array} Array of star objects
 */
function generateStars(sectors, densityMin, densityMax, random) {
  const stars = [];
  let starId = 0;
  
  for (let row = 0; row < sectors.length; row++) {
    for (let col = 0; col < sectors[row].length; col++) {
      const sector = sectors[row][col];
      const sectorStars = generateSectorStars(sector, densityMin, densityMax, random, starId);
      
      // Add stars to both sector and global array
      sector.stars = sectorStars;
      stars.push(...sectorStars);
      starId += sectorStars.length;
    }
  }
  
  return stars;
}

/**
 * Generate stars for a single sector
 * @param {Object} sector - Sector object
 * @param {number} densityMin - Minimum star density
 * @param {number} densityMax - Maximum star density
 * @param {SeededRandom} random - Random number generator
 * @param {number} startId - Starting star ID
 * @returns {Array} Array of star objects for this sector
 */
function generateSectorStars(sector, densityMin, densityMax, random, startId) {
  const stars = [];
  
  // Determine number of stars for this sector
  const starCount = random.nextInt(densityMin, densityMax);
  
  for (let i = 0; i < starCount; i++) {
    const star = generateStar(sector, random, startId + i);
    stars.push(star);
  }
  
  return stars;
}

/**
 * Generate a single star
 * @param {Object} sector - Sector this star belongs to
 * @param {SeededRandom} random - Random number generator
 * @param {number} id - Star ID
 * @returns {Object} Star object
 */
function generateStar(sector, random, id) {
  // Generate position within sector (0-1 range)
  const x = random.nextFloat(0, 1);
  const y = random.nextFloat(0, 1);
  const z = random.nextFloat(-0.5, 0.5); // Some depth variation
  
  // Convert to absolute coordinates
  const absoluteX = sector.sectorX + x;
  const absoluteY = sector.sectorY + y;
  const absoluteZ = z;
  
  // Generate star name using the pure function
  const name = generateStarName(random);
  
  return {
    id: `star_${id}`,
    name,
    sectorX: sector.sectorX,
    sectorY: sector.sectorY,
    x: absoluteX,
    y: absoluteY,
    z: absoluteZ
  };
}

/**
 * Generate edges (wormholes) between stars
 * @param {Array} sectors - 2D array of sectors
 * @param {Array} stars - Array of all stars
 * @param {SeededRandom} random - Random number generator
 * @returns {Array} Array of edge objects
 */
function generateEdges(sectors, stars, random) {
  const edges = [];
  let edgeId = 0;
  
  // Connect stars within each sector
  for (let row = 0; row < sectors.length; row++) {
    for (let col = 0; col < sectors[row].length; col++) {
      const sector = sectors[row][col];
      const sectorEdges = connectSectorStars(sector, random, edgeId);
      edges.push(...sectorEdges);
      edgeId += sectorEdges.length;
    }
  }
  
  // Connect adjacent sectors
  const interSectorEdges = connectAdjacentSectors(sectors, random, edgeId);
  edges.push(...interSectorEdges);
  
  return edges;
}

/**
 * Connect stars within a sector using minimum spanning tree
 * @param {Object} sector - Sector object
 * @param {SeededRandom} random - Random number generator
 * @param {number} startId - Starting edge ID
 * @returns {Array} Array of edge objects
 */
function connectSectorStars(sector, random, startId) {
  const edges = [];
  
  if (sector.stars.length < 2) return edges;
  
  const unconnected = [...sector.stars];
  const connected = [];
  
  // Start with first star
  connected.push(unconnected.shift());
  
  // Connect each unconnected star to the closest connected star
  while (unconnected.length > 0) {
    let nearestUnconnectedIndex = 0;
    let nearestConnectedStar = null;
    let nearestDistance = Infinity;
    
    // Find the unconnected star with shortest distance to any connected star
    for (let i = 0; i < unconnected.length; i++) {
      const unconnectedStar = unconnected[i];
      
      // Check distance to each connected star
      for (const connectedStar of connected) {
        const distance = getDistance(unconnectedStar, connectedStar);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestUnconnectedIndex = i;
          nearestConnectedStar = connectedStar;
        }
      }
    }
    
    // Connect the nearest unconnected star to its closest connected star
    const nearestStar = unconnected.splice(nearestUnconnectedIndex, 1)[0];
    connected.push(nearestStar);
    
    // Create edge
    edges.push({
      id: `edge_${startId + edges.length}`,
      aStarId: nearestConnectedStar.id,
      bStarId: nearestStar.id
    });
  }
  
  return edges;
}

/**
 * Connect adjacent sectors
 * @param {Array} sectors - 2D array of sectors
 * @param {SeededRandom} random - Random number generator
 * @param {number} startId - Starting edge ID
 * @returns {Array} Array of edge objects
 */
function connectAdjacentSectors(sectors, random, startId) {
  const edges = [];
  const mapSize = sectors.length;
  let edgeId = startId;
  
  for (let row = 0; row < mapSize; row++) {
    for (let col = 0; col < mapSize; col++) {
      const sector = sectors[row][col];
      
      // Connect to right neighbor
      if (col < mapSize - 1) {
        const rightSector = sectors[row][col + 1];
        const edge = connectSectors(sector, rightSector, random, edgeId);
        if (edge) {
          edges.push(edge);
          edgeId++;
        }
      }
      
      // Connect to bottom neighbor
      if (row < mapSize - 1) {
        const bottomSector = sectors[row + 1][col];
        const edge = connectSectors(sector, bottomSector, random, edgeId);
        if (edge) {
          edges.push(edge);
          edgeId++;
        }
      }
    }
  }
  
  return edges;
}

/**
 * Connect two sectors by connecting their closest stars
 * @param {Object} sector1 - First sector
 * @param {Object} sector2 - Second sector
 * @param {SeededRandom} random - Random number generator
 * @param {number} edgeId - Edge ID
 * @returns {Object|null} Edge object or null if no connection possible
 */
function connectSectors(sector1, sector2, random, edgeId) {
  if (sector1.stars.length === 0 || sector2.stars.length === 0) return null;
  
  // Find closest stars between sectors
  let closestPair = null;
  let closestDistance = Infinity;
  
  for (const star1 of sector1.stars) {
    for (const star2 of sector2.stars) {
      const distance = getDistance(star1, star2);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPair = [star1, star2];
      }
    }
  }
  
  if (closestPair) {
    return {
      id: `edge_${edgeId}`,
      aStarId: closestPair[0].id,
      bStarId: closestPair[1].id
    };
  }
  
  return null;
}

/**
 * Generate suggested player placements
 * @param {Array} sectors - 2D array of sectors
 * @param {Array} stars - Array of all stars
 * @param {SeededRandom} random - Random number generator
 * @returns {Array} Array of suggested player placement objects
 */
function generateSuggestedPlayerPlacements(sectors, stars, random) {
  const placements = [];
  const mapSize = sectors.length;
  
  // Place players in corners for balanced gameplay
  const cornerSectors = [
    { sectorX: 0, sectorY: 0 },
    { sectorX: mapSize - 1, sectorY: 0 },
    { sectorX: 0, sectorY: mapSize - 1 },
    { sectorX: mapSize - 1, sectorY: mapSize - 1 }
  ];
  
  for (const corner of cornerSectors) {
    const sector = sectors[corner.sectorY][corner.sectorX];
    
    if (sector.stars.length > 0) {
      // Pick a random star from this sector
      const star = random.pick(sector.stars);
      
      placements.push({
        sectorX: corner.sectorX,
        sectorY: corner.sectorY,
        starId: star.id
      });
    }
  }
  
  return placements;
}

/**
 * Calculate distance between two stars
 * @param {Object} star1 - First star
 * @param {Object} star2 - Second star
 * @returns {number} Distance
 */
function getDistance(star1, star2) {
  return Math.sqrt(
    Math.pow(star1.x - star2.x, 2) + 
    Math.pow(star1.y - star2.y, 2) + 
    Math.pow(star1.z - star2.z, 2)
  );
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
