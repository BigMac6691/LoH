import { Economy } from './Economy.js';
import { getUniqueGeneratedName } from './starNameGenerator.js';

/**
 * Star - Represents a star system in the game
 * Uses a data-centric approach with direct data assignment for maximum performance.
 * All data is stored in a data object and methods operate on that data.
 * No copying overhead - direct reference to input data.
 */
export class Star {
  /**
   * Create a new Star instance
   * @param {Object} data - Star data object (direct reference, no copying)
   * @param {string|number} data.id - Unique identifier for the star
   * @param {string} data.name - Star name (optional, will be generated if not provided)
   * @param {number} data.x - X coordinate
   * @param {number} data.y - Y coordinate
   * @param {number} data.z - Z coordinate
   * @param {Object} data.sector - Sector this star belongs to {row, col}
   * @param {number} data.resourceValue - Natural resource abundance (0-100)
   * @param {string|null} data.owner - Player ID who owns this star (optional)
   * @param {string} data.color - Visual color of the star (default: light gray)
   * @param {Object|null} data.economy - Economy data object (optional)
   * @param {Array} data.ships - Array of ship IDs at this star (optional)
   * @param {Array} data.connectedStarIds - Array of connected star IDs (optional)
   */
  constructor(data) {
    // Direct assignment - no copying overhead
    this.data = data;
  }

  // ===== DATA ACCESS METHODS =====

  /**
   * Get the star ID
   * @returns {string|number} Star ID
   */
  getId() {
    return this.data.id;
  }

  /**
   * Get the star name
   * @returns {string|null} Star name
   */
  getName() {
    return this.data.name;
  }

  /**
   * Set the star name
   * @param {string} name - New name
   */
  setName(name) {
    if (name && typeof name === 'string' && name.trim().length > 0) {
      this.data.name = name.trim();
    }
  }

  /**
   * Check if star has a name
   * @returns {boolean} True if star has a name
   */
  hasName() {
    return this.data.name !== null && this.data.name.trim().length > 0;
  }

  /**
   * Generate a unique name for this star
   * @param {Object} seededRandom - SeededRandom instance for deterministic generation
   * @returns {string} Generated star name
   */
  generateName(seededRandom) {
    if (!this.data.name) {
      this.data.name = getUniqueGeneratedName(seededRandom);
    }
    return this.data.name;
  }

  /**
   * Get star position
   * @returns {Object} Position object {x, y, z}
   */
  getPosition() {
    return {
      x: this.data.x,
      y: this.data.y,
      z: this.data.z
    };
  }

  /**
   * Set star position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} z - Z coordinate
   */
  setPosition(x, y, z) {
    this.data.x = x;
    this.data.y = y;
    this.data.z = z;
  }

  /**
   * Get star sector
   * @returns {Object} Sector object {row, col}
   */
  getSector() {
    return { ...this.data.sector };
  }

  /**
   * Set star sector
   * @param {number} row - Sector row
   * @param {number} col - Sector column
   */
  setSector(row, col) {
    this.data.sector = { row, col };
  }

  /**
   * Get resource value
   * @returns {number} Resource value (0-100)
   */
  getResourceValue() {
    return this.data.resourceValue;
  }

  /**
   * Set resource value
   * @param {number} value - New resource value (0-100)
   */
  setResourceValue(value) {
    this.data.resourceValue = Math.max(0, Math.min(100, value));
  }

  /**
   * Get star color
   * @returns {string} Color hex value
   */
  getColor() {
    return this.data.color;
  }

  /**
   * Set star color
   * @param {string} color - Color hex value
   */
  setColor(color) {
    this.data.color = color;
  }

  // ===== OWNERSHIP METHODS =====

  /**
   * Get the owner ID
   * @returns {string|null} Owner ID or null if unowned
   */
  getOwner() {
    return this.data.owner;
  }

  /**
   * Set the owner ID
   * @param {string|null} ownerId - Owner ID or null to remove ownership
   */
  setOwner(ownerId) {
    this.data.owner = ownerId;
  }

  /**
   * Check if star is owned
   * @returns {boolean} True if star has an owner
   */
  isOwned() {
    return this.data.owner !== null;
  }

  /**
   * Assign ownership with color
   * @param {string} ownerId - Owner ID
   * @param {string} color - Owner color
   */
  assignOwner(ownerId, color) {
    this.data.owner = ownerId;
    if (color) {
      this.data.color = color;
    }
  }

  /**
   * Remove ownership
   */
  removeOwner() {
    this.data.owner = null;
    this.data.color = '#CCCCCC'; // Reset to default
  }

  // ===== ECONOMY METHODS =====

  /**
   * Get economy data
   * @returns {Object|null} Economy data object or null
   */
  getEconomy() {
    return this.data.economy;
  }

  /**
   * Set economy data
   * @param {Object|null} economyData - Economy data object or null
   */
  setEconomy(economyData) {
    this.data.economy = economyData;
  }

  /**
   * Check if star has economy
   * @returns {boolean} True if star has economy
   */
  hasEconomy() {
    return this.data.economy !== null;
  }

  /**
   * Create economy data
   * @param {Object} economyOptions - Economy options
   * @returns {Object} Created economy data
   */
  createEconomy(economyOptions = {}) {
    if (!this.data.economy) {
      this.data.economy = new Economy(economyOptions).toJSON();
    }
    return this.data.economy;
  }

  /**
   * Remove economy
   */
  removeEconomy() {
    this.data.economy = null;
  }

  // ===== SHIP MANAGEMENT METHODS =====

  /**
   * Get ship IDs at this star
   * @returns {Array} Array of ship IDs
   */
  getShipIds() {
    return [...this.data.ships];
  }

  /**
   * Add a ship ID to this star
   * @param {string} shipId - Ship ID to add
   */
  addShip(shipId) {
    if (shipId && !this.data.ships.includes(shipId)) {
      this.data.ships.push(shipId);
    }
  }

  /**
   * Remove a ship ID from this star
   * @param {string} shipId - Ship ID to remove
   */
  removeShip(shipId) {
    const index = this.data.ships.indexOf(shipId);
    if (index !== -1) {
      this.data.ships.splice(index, 1);
    }
  }

  /**
   * Check if star has ships
   * @returns {boolean} True if star has ships
   */
  hasShips() {
    return this.data.ships.length > 0;
  }

  /**
   * Get ship count
   * @returns {number} Number of ships
   */
  getShipCount() {
    return this.data.ships.length;
  }

  /**
   * Clear all ships
   */
  clearShips() {
    this.data.ships = [];
  }

  // ===== CONNECTION METHODS =====

  /**
   * Get connected star IDs
   * @returns {Array} Array of connected star IDs
   */
  getConnectedStarIds() {
    return [...this.data.connectedStarIds];
  }

  /**
   * Get connected Star objects (requires a lookup function)
   * @param {Function} lookupFn - Function to look up stars by ID (e.g., mapModel.getStarById)
   * @returns {Array} Array of connected Star objects
   */
  getConnectedStars(lookupFn) {
    if (!lookupFn || typeof lookupFn !== 'function') {
      console.warn('getConnectedStars requires a lookup function');
      return [];
    }
    return this.data.connectedStarIds
      .map(id => lookupFn(id))
      .filter(star => star !== null);
  }

  /**
   * Add a connected star ID
   * @param {string} starId - Star ID to connect to
   */
  addConnectedStar(starId) {
    if (starId && starId !== this.data.id && !this.data.connectedStarIds.includes(starId)) {
      this.data.connectedStarIds.push(starId);
    }
  }

  /**
   * Remove a connected star ID
   * @param {string} starId - Star ID to disconnect from
   */
  removeConnectedStar(starId) {
    const index = this.data.connectedStarIds.indexOf(starId);
    if (index !== -1) {
      this.data.connectedStarIds.splice(index, 1);
    }
  }

  /**
   * Check if connected to a star
   * @param {string} starId - Star ID to check
   * @returns {boolean} True if connected
   */
  isConnectedTo(starId) {
    return this.data.connectedStarIds.includes(starId);
  }

  /**
   * Get connection count
   * @returns {number} Number of connections
   */
  getConnectionCount() {
    return this.data.connectedStarIds.length;
  }

  /**
   * Clear all connections
   */
  clearConnections() {
    this.data.connectedStarIds = [];
  }

  // ===== UTILITY METHODS =====

  /**
   * Calculate distance to another star
   * @param {Star} otherStar - Star to calculate distance to
   * @returns {number} Euclidean distance
   */
  getDistanceTo(otherStar) {
    const otherPos = otherStar.getPosition();
    const dx = this.data.x - otherPos.x;
    const dy = this.data.y - otherPos.y;
    const dz = this.data.z - otherPos.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Get a summary of this star's current state
   * @returns {Object} Star summary
   */
  getSummary() {
    return {
      id: this.data.id,
      name: this.data.name,
      position: this.getPosition(),
      sector: this.getSector(),
      resourceValue: this.data.resourceValue,
      owner: this.data.owner,
      color: this.data.color,
      connectionCount: this.getConnectionCount(),
      shipCount: this.getShipCount(),
      hasEconomy: this.hasEconomy(),
      economy: this.data.economy
    };
  }

  /**
   * Create a copy of this star
   * @returns {Star} New Star instance with same data
   */
  clone() {
    return new Star({ ...this.data });
  }

  /**
   * Return the current data state as JSON
   * @returns {Object} Current data object (direct reference, no copying)
   */
  toJSON() {
    return this.data;
  }

  /**
   * Get the raw data object (use with caution)
   * @returns {Object} Raw data object
   */
  getData() {
    return this.data;
  }
} 