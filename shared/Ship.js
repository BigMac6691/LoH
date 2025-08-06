/**
 * Ship - Represents a ship in the game
 * Contains power, damage, and location information
 */
export class Ship {
  /**
   * Create a new Ship instance
   * @param {Object} options - Ship configuration options
   * @param {number} options.id - Unique identifier for the ship
   * @param {number} options.power - Ship's power rating
   * @param {number} options.damage - Ship's damage capability
   * @param {Object} options.owner - Player who owns this ship (optional)
   * @param {Star} options.location - Star where this ship is located (optional)
   */
  constructor(options = {}) {
    // Required properties
    this.id = options.id;
    this.power = options.power || 0;
    this.damage = options.damage || 0;
    
    // Optional properties
    this.owner = options.owner || null;
    this.location = options.location || null;
    
    // Set location if provided
    if (this.location && this.location.addShip) {
      this.location.addShip(this);
    }
  }

  /**
   * Get the ship's power
   * @returns {number} Ship power
   */
  getPower() {
    return this.power;
  }

  /**
   * Set the ship's power
   * @param {number} power - New power value
   */
  setPower(power) {
    this.power = Math.max(0, power);
  }

  /**
   * Get the ship's damage
   * @returns {number} Ship damage
   */
  getDamage() {
    return this.damage;
  }

  /**
   * Set the ship's damage
   * @param {number} damage - New damage value
   */
  setDamage(damage) {
    this.damage = Math.max(0, damage);
  }

  /**
   * Get the damage percentage
   * @returns {number} Damage percentage (damage / power)
   */
  getDamagePercentage() {
    if (this.power === 0) {
      return 0; // Avoid division by zero
    }
    return (this.damage / this.power) * 100;
  }

  /**
   * Check if the ship can move
   * @returns {boolean} True if damage percentage is less than 50%
   */
  canMove() {
    return this.getDamagePercentage() < 50;
  }

  /**
   * Get the ship's owner
   * @returns {Object|null} Owner or null if unowned
   */
  getOwner() {
    return this.owner;
  }

  /**
   * Set the ship's owner
   * @param {Object} owner - New owner
   */
  setOwner(owner) {
    this.owner = owner;
  }

  /**
   * Check if this ship is owned
   * @returns {boolean} True if ship has an owner
   */
  isOwned() {
    return this.owner !== null;
  }

  /**
   * Get the ship's current location
   * @returns {Star|null} Current location or null if not at a star
   */
  getLocation() {
    return this.location;
  }

  /**
   * Set the ship's location
   * @param {Star|null} star - Star to move to, or null to remove from location
   */
  setLocation(star) {
    // Remove from current location
    if (this.location && this.location.removeShip) {
      this.location.removeShip(this);
    }
    
    // Set new location
    this.location = star;
    
    // Add to new location
    if (star && star.addShip) {
      star.addShip(this);
    }
  }

  /**
   * Move the ship to a new location
   * @param {Star} star - Star to move to
   */
  moveTo(star) {
    this.setLocation(star);
  }

  /**
   * Check if the ship is at a specific location
   * @param {Star} star - Star to check
   * @returns {boolean} True if ship is at the specified star
   */
  isAt(star) {
    return this.location === star;
  }

  /**
   * Get a summary of this ship's current state
   * @returns {Object} Ship summary
   */
  getSummary() {
    return {
      id: this.id,
      power: this.power,
      damage: this.damage,
      damagePercentage: this.getDamagePercentage(),
      canMove: this.canMove(),
      owner: this.owner,
      location: this.location ? this.location.id : null
    };
  }

  /**
   * Create a copy of this ship
   * @returns {Ship} New Ship instance with same values
   */
  clone() {
    return new Ship({
      id: this.id,
      power: this.power,
      damage: this.damage,
      owner: this.owner,
      location: null // Don't clone location to avoid circular references
    });
  }
}