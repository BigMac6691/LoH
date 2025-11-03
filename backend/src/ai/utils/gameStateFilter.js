/**
 * gameStateFilter - Utility functions for filtering game state for players
 * Currently returns full state, but structured for future fog-of-war implementation
 */

/**
 * Filter game state for a specific player
 * @param {Object} fullGameState - Complete game state
 * @param {string} playerId - Player ID
 * @returns {Object} Filtered game state visible to the player
 */
export function filterGameStateForPlayer(fullGameState, playerId) {
  // TODO: Implement fog-of-war filtering
  // For now, return full state
  
  return {
    stars: fullGameState.stars || [],
    wormholes: fullGameState.wormholes || [],
    starStates: fullGameState.starStates || [],
    ships: fullGameState.ships || [],
    players: fullGameState.players || [],
    gameInfo: fullGameState.gameInfo || {}
  };
}

/**
 * Get the player's own data from the game state
 * @param {Object} gameState - Game state
 * @param {string} playerId - Player ID
 * @returns {Object|null} Player data or null if not found
 */
export function getPlayerData(gameState, playerId) {
  const players = gameState.players || [];
  return players.find(p => p.id === playerId) || null;
}

/**
 * Check if a star is visible to the player
 * @param {Object} starState - Star state
 * @param {string} playerId - Player ID
 * @returns {boolean} True if visible
 */
export function isStarVisible(starState, playerId) {
  // TODO: Implement fog-of-war logic
  // For now, all stars are visible
  return true;
}

/**
 * Check if a ship is visible to the player
 * @param {Object} ship - Ship data
 * @param {string} playerId - Player ID
 * @returns {boolean} True if visible
 */
export function isShipVisible(ship, playerId) {
  // TODO: Implement fog-of-war logic
  // For now, all ships are visible
  return true;
}

