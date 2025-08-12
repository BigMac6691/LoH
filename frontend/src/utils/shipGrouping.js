/**
 * Ship grouping utilities for MoveDialog
 * Pure functions for organizing ships into hierarchical trees
 */

/**
 * Group ships by power level and damage category
 * @param {Array<Ship>} ships - Array of ships to group
 * @returns {Object} Hierarchical tree structure
 */
export function groupShipsByPowerAndDamage(ships) {
  if (!Array.isArray(ships) || ships.length === 0) {
    return {
      powerGroups: [],
      totalShips: 0,
      totalPower: 0
    };
  }

  // Group ships by power level (descending)
  const powerGroups = {};
  
  ships.forEach(ship => {
    const power = ship.getPower ? ship.getPower() : ship.power || 0;
    const damage = ship.getDamage ? ship.getDamage() : ship.damage || 0;
    const damagePercentage = ship.getDamagePercentage ? ship.getDamagePercentage() : 
                           (power > 0 ? (damage / power) * 100 : 0);
    
    if (!powerGroups[power]) {
      powerGroups[power] = {
        power: power,
        totalCount: 0,
        totalPower: 0,
        categories: {
          undamaged: { ships: [], count: 0, power: 0 },
          damagedMobile: { ships: [], count: 0, power: 0 },
          damagedImmobile: { ships: [], count: 0, power: 0 }
        }
      };
    }

    const group = powerGroups[power];
    group.totalCount++;
    group.totalPower += power;

    // Categorize ship by damage
    if (damage === 0) {
      group.categories.undamaged.ships.push(ship);
      group.categories.undamaged.count++;
      group.categories.undamaged.power += power;
    } else if (damagePercentage < 50) {
      group.categories.damagedMobile.ships.push(ship);
      group.categories.damagedMobile.count++;
      group.categories.damagedMobile.power += power;
    } else {
      group.categories.damagedImmobile.ships.push(ship);
      group.categories.damagedImmobile.count++;
      group.categories.damagedImmobile.power += power;
    }
  });

  // Sort damaged mobile ships by HP (least damaged first)
  Object.values(powerGroups).forEach(group => {
    group.categories.damagedMobile.ships.sort((a, b) => {
      const aHp = a.getPower ? a.getPower() - a.getDamage() : (a.power || 0) - (a.damage || 0);
      const bHp = b.getPower ? b.getPower() - b.getDamage() : (b.power || 0) - (b.damage || 0);
      return bHp - aHp; // Descending order (highest HP first)
    });
  });

  // Convert to array and sort by power (descending)
  const powerGroupsArray = Object.values(powerGroups).sort((a, b) => b.power - a.power);

  // Calculate totals
  const totalShips = ships.length;
  const totalPower = ships.reduce((sum, ship) => {
    const power = ship.getPower ? ship.getPower() : ship.power || 0;
    return sum + power;
  }, 0);

  return {
    powerGroups: powerGroupsArray,
    totalShips,
    totalPower
  };
}

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

/**
 * Get ship health percentage
 * @param {Ship} ship - Ship object
 * @returns {number} Health percentage (0-100)
 */
export function getShipHealthPercentage(ship) {
  const power = ship.getPower ? ship.getPower() : ship.power || 0;
  const damage = ship.getDamage ? ship.getDamage() : ship.damage || 0;
  
  if (power === 0) return 100;
  
  const health = power - damage;
  return Math.max(0, Math.min(100, (health / power) * 100));
}

/**
 * Check if ship can move
 * @param {Ship} ship - Ship object
 * @returns {boolean} True if ship can move
 */
export function canShipMove(ship) {
  if (ship.canMove) {
    return ship.canMove();
  }
  
  const damagePercentage = ship.getDamagePercentage ? ship.getDamagePercentage() : 
                          (() => {
                            const power = ship.getPower ? ship.getPower() : ship.power || 0;
                            const damage = ship.getDamage ? ship.getDamage() : ship.damage || 0;
                            return power > 0 ? (damage / power) * 100 : 0;
                          })();
  
  return damagePercentage < 50;
}
