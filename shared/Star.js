import { Economy } from './Economy.js';
import { getUniqueGeneratedName } from './starNameGenerator.js';

/**
 * Star - Represents a star system in the game
 * Contains resource value, optional economy, and ownership information
 */
export class Star {
  /**
   * Create a new Star instance
   * @param {Object} options - Star configuration options
   * @param {number} options.id - Unique identifier for the star
   * @param {number} options.x - X coordinate
   * @param {number} options.y - Y coordinate
   * @param {number} options.z - Z coordinate
   * @param {Object} options.sector - Sector this star belongs to
   * @param {number} options.resourceValue - Natural resource abundance (0-100)
   * @param {Object} options.owner - Player who owns this star (optional)
   * @param {string} options.color - Visual color of the star (default: light gray)
   * @param {boolean} options.hasEconomy - Whether to create an Economy instance (default: false)
   */
  constructor(options) {
    // Required properties
    this.id = options.id;
    this.x = options.x;
    this.y = options.y;
    this.z = options.z;
    this.sector = options.sector;
    
    // Resource and ownership properties
    this.resourceValue = Math.max(0, Math.min(100, options.resourceValue || 0));
    this.owner = options.owner || null;
    this.color = options.color || '#CCCCCC';
    
    // Name property
    this.name = options.name || null;
    
    // Connection state
    this.connected = false;
    
    // List of connected stars (for pathfinding)
    this.connectedStars = [];
    
    // List of ships at this star
    this.ships = [];
    
    // Optional economy
    this.economy = options.hasEconomy ? new Economy() : null;
  }

  /**
   * Assign ownership of this star to a player
   * @param {Object} player - Player object to assign ownership to
   */
  assignOwner(player) {
    this.owner = player;
    if (player && player.color) {
      this.color = player.color;
    }
  }

  /**
   * Remove ownership from this star
   */
  removeOwner() {
    this.owner = null;
    this.color = '#CCCCCC'; // Reset to default light gray
  }

  /**
   * Check if this star is owned by a player
   * @returns {boolean} True if star has an owner
   */
  isOwned() {
    return this.owner !== null;
  }

  /**
   * Get the current owner of this star
   * @returns {Object|null} Player object or null if unowned
   */
  getOwner() {
    return this.owner;
  }

  /**
   * Get the resource value of this star
   * @returns {number} Resource value (0-100)
   */
  getResourceValue() {
    return this.resourceValue;
  }

  /**
   * Set the resource value of this star
   * @param {number} value - New resource value (0-100)
   */
  setResourceValue(value) {
    this.resourceValue = Math.max(0, Math.min(100, value));
  }

  /**
   * Create an economy for this star if it doesn't have one
   * @param {Object} economyOptions - Options to pass to Economy constructor
   * @returns {Economy} The created or existing economy
   */
  createEconomy(economyOptions = {}) {
    if (!this.economy) {
      this.economy = new Economy(economyOptions);
    }
    return this.economy;
  }

  /**
   * Get the economy of this star
   * @returns {Economy|null} Economy instance or null if none exists
   */
  getEconomy() {
    return this.economy;
  }

  /**
   * Remove the economy from this star
   */
  removeEconomy() {
    this.economy = null;
  }

  /**
   * Check if this star has an economy
   * @returns {boolean} True if star has an economy
   */
  hasEconomy() {
    return this.economy !== null;
  }

  /**
   * Get a summary of this star's current state
   * @returns {Object} Star summary
   */
  getSummary() {
    return {
      id: this.id,
      name: this.name,
      position: { x: this.x, y: this.y, z: this.z },
      sector: this.sector,
      resourceValue: this.resourceValue,
      owner: this.owner,
      color: this.color,
      connected: this.connected,
      connectedStars: this.connectedStars.map(star => star.id),
      connectionCount: this.getConnectionCount(),
      ships: this.ships.map(ship => ship.getSummary ? ship.getSummary() : ship),
      shipCount: this.getShipCount(),
      totalShipPower: this.getTotalShipPower(),
      totalShipDamage: this.getTotalShipDamage(),
      hasEconomy: this.hasEconomy(),
      economy: this.economy ? this.economy.getSummary() : null
    };
  }

  /**
   * Create a copy of this star
   * @returns {Star} New Star instance with same values
   */
  clone() {
    const clonedStar = new Star({
      id: this.id,
      x: this.x,
      y: this.y,
      z: this.z,
      sector: this.sector,
      resourceValue: this.resourceValue,
      owner: this.owner,
      color: this.color,
      name: this.name,
      hasEconomy: false // Don't clone economy by default
    });
    
    // Copy connection state
    clonedStar.connected = this.connected;
    
    // Note: connectedStars list is not cloned as it would create circular references
    // The connections would need to be re-established after cloning all stars
    
    // Clone economy if it exists
    if (this.economy) {
      clonedStar.economy = this.economy.clone();
    }
    
    return clonedStar;
  }

  /**
   * Get the distance to another star
   * @param {Star} otherStar - Star to calculate distance to
   * @returns {number} Euclidean distance between stars
   */
  getDistanceTo(otherStar) {
    const dx = this.x - otherStar.x;
    const dy = this.y - otherStar.y;
    const dz = this.z - otherStar.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Generate a unique name for this star
   * @param {Object} seededRandom - SeededRandom instance for deterministic generation
   * @returns {string} Generated star name
   */
  generateName(seededRandom) {
    if (!this.name) {
      this.name = getUniqueGeneratedName(seededRandom);
    }
    return this.name;
  }

  /**
   * Get the name of this star
   * @returns {string|null} Star name or null if not set
   */
  getName() {
    return this.name;
  }

  /**
   * Set a custom name for this star
   * @param {string} name - Custom name to set
   */
  setName(name) {
    if (name && typeof name === 'string' && name.trim().length > 0) {
      this.name = name.trim();
    }
  }

  /**
   * Check if this star has a name
   * @returns {boolean} True if star has a name
   */
  hasName() {
    return this.name !== null && this.name.trim().length > 0;
  }

  /**
   * Add a star to the connected stars list
   * @param {Star} star - Star to connect to
   */
  addConnectedStar(star) {
    if (star && star !== this && !this.connectedStars.includes(star)) {
      this.connectedStars.push(star);
    }
  }

  /**
   * Remove a star from the connected stars list
   * @param {Star} star - Star to disconnect from
   */
  removeConnectedStar(star) {
    const index = this.connectedStars.indexOf(star);
    if (index !== -1) {
      this.connectedStars.splice(index, 1);
    }
  }

  /**
   * Get all connected stars
   * @returns {Array} Array of connected Star objects
   */
  getConnectedStars() {
    return [...this.connectedStars]; // Return a copy to prevent external modification
  }

  /**
   * Check if this star is connected to another star
   * @param {Star} star - Star to check connection with
   * @returns {boolean} True if connected
   */
  isConnectedTo(star) {
    return this.connectedStars.includes(star);
  }

  /**
   * Get the number of connected stars
   * @returns {number} Number of connected stars
   */
  getConnectionCount() {
    return this.connectedStars.length;
  }

  /**
   * Clear all connections
   */
  clearConnections() {
    this.connectedStars = [];
    this.connected = false;
  }

  /**
   * Add a ship to this star
   * @param {Ship} ship - Ship to add
   */
  addShip(ship) {
    if (ship && !this.ships.includes(ship)) {
      this.ships.push(ship);
      // Set the ship's location to this star
      if (ship.setLocation) {
        ship.setLocation(this);
      }
    }
  }

  /**
   * Remove a ship from this star
   * @param {Ship} ship - Ship to remove
   */
  removeShip(ship) {
    const index = this.ships.indexOf(ship);
    if (index !== -1) {
      this.ships.splice(index, 1);
      // Clear the ship's location
      if (ship.setLocation) {
        ship.setLocation(null);
      }
    }
  }

  /**
   * Get all ships at this star
   * @returns {Array} Array of Ship objects
   */
  getShips() {
    return [...this.ships]; // Return a copy to prevent external modification
  }

  /**
   * Get ships belonging to a specific owner
   * @param {Object} owner - Owner to filter by
   * @returns {Array} Array of Ship objects belonging to the owner
   */
  getShipsByOwner(owner) {
    return this.ships.filter(ship => ship.owner === owner);
  }

  /**
   * Get the number of ships at this star
   * @returns {number} Number of ships
   */
  getShipCount() {
    return this.ships.length;
  }

  /**
   * Get the total power of all ships at this star
   * @returns {number} Total ship power
   */
  getTotalShipPower() {
    return this.ships.reduce((total, ship) => total + (ship.power || 0), 0);
  }

  /**
   * Get the total damage of all ships at this star
   * @returns {number} Total ship damage
   */
  getTotalShipDamage() {
    return this.ships.reduce((total, ship) => total + (ship.damage || 0), 0);
  }

  /**
   * Check if this star has any ships
   * @returns {boolean} True if star has ships
   */
  hasShips() {
    return this.ships.length > 0;
  }

  /**
   * Clear all ships from this star
   */
  clearShips() {
    // Clear location for all ships
    this.ships.forEach(ship => {
      if (ship.setLocation) {
        ship.setLocation(null);
      }
    });
    this.ships = [];
  }
} 