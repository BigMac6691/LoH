/**
 * Economy - Represents the economic development of a location (star or planet)
 * Designed to be attached to stars initially, but can be moved to planets later
 */
export class Economy {
  /**
   * Create a new Economy instance
   * @param {Object} options - Economy configuration options
   * @param {number} options.techLevel - Initial technology level (default: 0)
   */
  constructor(options = {}) {
    this.techLevel = options.technology;
    
    // Economic capacity and availability
    this.capacity = options.industry;
    this.available = options.available;
  }

  /**
   * Get a summary of the economy's current state
   * @returns {Object} Economy summary
   */
  getSummary() {
    return {
      techLevel: this.techLevel,
      capacity: this.capacity,
      available: this.available
    };
  }

  /**
   * Create a copy of this economy
   * @returns {Economy} New Economy instance with same values
   */
  clone() {
    return new Economy({
      techLevel: this.techLevel,
      capacity: this.capacity,
      available: this.available
    });
  }

  /**
   * Return the current data state as JSON
   * @returns {Object} Current data object
   */
  toJSON() {
    return {
      techLevel: this.techLevel,
      capacity: this.capacity,
      available: this.available
    };
  }
} 