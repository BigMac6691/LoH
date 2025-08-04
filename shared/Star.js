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
} 