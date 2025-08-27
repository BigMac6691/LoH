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
    this.techLevel = options.techLevel || 0;
    
    // Economic capacity and availability
    this.capacity = options.capacity || 100;
    this.available = options.available || 100;
    
    // Future expansion properties
    this.tradeValue = 0;
    this.infrastructureValue = 0;
    this.productionCapacity = 0;
  }

  /**
   * Invest resources to increase capacity
   * @param {number} amount - Amount to invest
   * @returns {number} New capacity after investment
   */
  invest(amount) {
    if (amount <= 0) {
      throw new Error('Investment amount must be positive');
    }
    
    this.capacity += amount;
    return this.capacity;
  }

  /**
   * Get the total economic value (sum of all economic metrics)
   * @returns {number} Total economic value
   */
  getTotalValue() {
    return this.capacity + this.techLevel + this.tradeValue + this.infrastructureValue + this.productionCapacity;
  }

  /**
   * Get a summary of the economy's current state
   * @returns {Object} Economy summary
   */
  getSummary() {
    return {
      techLevel: this.techLevel,
      capacity: this.capacity,
      available: this.available,
      tradeValue: this.tradeValue,
      infrastructureValue: this.infrastructureValue,
      productionCapacity: this.productionCapacity,
      totalValue: this.getTotalValue()
    };
  }

  /**
   * Reset the economy to initial state
   */
  reset() {
    this.techLevel = 0;
    this.capacity = 100;
    this.available = 100;
    this.tradeValue = 0;
    this.infrastructureValue = 0;
    this.productionCapacity = 0;
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
      available: this.available,
      tradeValue: this.tradeValue,
      infrastructureValue: this.infrastructureValue,
      productionCapacity: this.productionCapacity
    };
  }
} 