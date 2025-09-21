/**
 * Ship utility functions for MoveDialog
 * Simple utility functions for ship display and management
 */

/**
 * Get ship display name
 * @param {Ship} ship - Ship object
 * @returns {string} Display name
 */
export function getShipDisplayName(ship) {
  if (ship.getName) {
    return ship.getName();
  }
  
  // Get ship ID and use last 4 characters
  const shipId = ship.id || ship.getId?.() || 'Unknown';
  const shortId = shipId.length > 4 ? shipId.slice(-4) : shipId;
  
  return `Ship ${shortId}`;
}

