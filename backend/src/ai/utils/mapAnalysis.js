/**
 * mapAnalysis - Utility functions for analyzing the game map
 */

/**
 * Get adjacent stars for a given star
 * @param {string} starId - Star ID
 * @param {Array} wormholes - Array of wormholes
 * @returns {Array<string>} Array of adjacent star IDs
 */
export function getAdjacentStars(starId, wormholes) {
  const adjacent = [];
  console.log('Adjacent stars for star', starId);
  
  for (const wormhole of wormholes) {
    console.log('Wormhole', wormhole);
    if (wormhole.star_a_id === starId) {
      adjacent.push(wormhole.star_b_id);
    } else if (wormhole.star_b_id === starId) {
      adjacent.push(wormhole.star_a_id);
    }
  }
  
  return adjacent;
}

/**
 * Get stars owned by a player
 * @param {string} playerId - Player ID
 * @param {Array} starStates - Array of star states
 * @returns {Array} Array of star states owned by the player
 */
export function getOwnedStars(playerId, starStates) {
  return starStates.filter(star => star.owner_player === playerId);
}

/**
 * Get ships at a specific star
 * @param {string} starId - Star ID
 * @param {Array} ships - Array of ships
 * @returns {Array} Array of ships at the star
 */
export function getShipsAtStar(starId, ships) {
  return ships.filter(ship => ship.location_star_id === starId);
}

/**
 * Calculate friendly vs enemy ship ratio at a star
 * @param {string} starId - Star ID
 * @param {string} playerId - Player ID
 * @param {Array} ships - Array of ships
 * @returns {number} Ratio of friendly to enemy ships (0 if no enemy ships)
 */
export function calculateShipRatio(starId, playerId, ships) {
  const shipsAtStar = getShipsAtStar(starId, ships);
  
  let friendlyShips = 0;
  let enemyShips = 0;
  
  for (const ship of shipsAtStar) {
    if (ship.owner_player === playerId) {
      friendlyShips += 1; // Could be ship.hp or ship.power if we want different calculations
    } else {
      enemyShips += 1;
    }
  }
  
  // Return 0 if no enemy ships (safe to attack or no combat needed)
  if (enemyShips === 0) {
    return 0;
  }
  
  return friendlyShips / enemyShips;
}

/**
 * Get the star state for a specific star
 * @param {string} starId - Star ID
 * @param {Array} starStates - Array of star states
 * @returns {Object|null} Star state or null if not found
 */
export function getStarState(starId, starStates) {
  return starStates.find(state => state.star_id === starId) || null;
}

/**
 * Calculate total available industry points for a player
 * @param {string} playerId - Player ID
 * @param {Array} starStates - Array of star states
 * @returns {number} Total available industry points
 */
export function calculateTotalAvailableIndustry(playerId, starStates) {
  const ownedStars = getOwnedStars(playerId, starStates);
  
  let totalAvailable = 0;
  for (const star of ownedStars) {
    const economy = star.economy || {};
    totalAvailable += economy.available || 0;
  }
  
  return totalAvailable;
}

/**
 * Get unowned stars adjacent to a player's owned stars
 * @param {string} playerId - Player ID
 * @param {Array} starStates - Array of star states
 * @param {Array} wormholes - Array of wormholes
 * @returns {Array<string>} Array of unowned star IDs adjacent to player stars
 */
export function getUnownedAdjacentStars(playerId, starStates, wormholes) {
  const ownedStars = getOwnedStars(playerId, starStates);
  const ownedStarIds = ownedStars.map(star => star.star_id);
  const unownedAdjacent = new Set();
  
  // Get all adjacent stars to owned stars
  for (const ownedStar of ownedStars) {
    const adjacent = getAdjacentStars(ownedStar.star_id, wormholes);
    for (const adjStarId of adjacent) {
      // Check if this adjacent star is owned
      const isOwned = starStates.some(state => 
        state.star_id === adjStarId && state.owner_player === playerId
      );
      if (!isOwned) {
        unownedAdjacent.add(adjStarId);
      }
    }
  }
  
  return Array.from(unownedAdjacent);
}

/**
 * Calculate strength of ships (for tactical decisions)
 * @param {Array} ships - Array of ships
 * @param {string} playerId - Player ID (optional, to filter by owner)
 * @returns {number} Total strength (sum of HP or power)
 */
export function calculateShipStrength(ships, playerId = null) {
  let relevantShips = ships;
  
  if (playerId) {
    relevantShips = ships.filter(ship => ship.owner_player === playerId);
  }
  
  return relevantShips.reduce((total, ship) => total + (ship.hp || 0), 0);
}

