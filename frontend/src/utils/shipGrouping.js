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
  
  // Generate a name based on ship properties
  const power = ship.getPower ? ship.getPower() : ship.power || 0;
  const damage = ship.getDamage ? ship.getDamage() : ship.damage || 0;
  
  if (power > 0) {
    const shipType = power >= 100 ? 'Battleship' : 
                    power >= 50 ? 'Cruiser' : 
                    power >= 25 ? 'Destroyer' : 'Frigate';
    return `${shipType} ${ship.id || 'Unknown'}`;
  }
  
  return `Ship ${ship.id || 'Unknown'}`;
}

