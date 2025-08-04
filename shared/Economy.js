/**
 * Economy - Represents the economic development of a location (star or planet)
 * Designed to be attached to stars initially, but can be moved to planets later
 */
export class Economy {
  /**
   * Create a new Economy instance
   * @param {Object} options - Economy configuration options
   * @param {number} options.industrialValue - Initial industrial value (default: 0)
   * @param {number} options.techLevel - Initial technology level (default: 0)
   */
  constructor(options = {}) {
    this.industrialValue = options.industrialValue || 0;
    this.techLevel = options.techLevel || 0;
    
    // Future expansion properties
    this.tradeValue = 0;
    this.infrastructureValue = 0;
    this.productionCapacity = 0;
  }

  /**
   * Invest resources to increase industrial development
   * @param {number} amount - Amount to invest
   * @returns {number} New industrial value after investment
   */
  invest(amount) {
    if (amount <= 0) {
      throw new Error('Investment amount must be positive');
    }
    
    this.industrialValue += amount;
    return this.industrialValue;
  }

  /**
   * Get the total economic value (sum of all economic metrics)
   * @returns {number} Total economic value
   */
  getTotalValue() {
    return this.industrialValue + this.techLevel + this.tradeValue + this.infrastructureValue + this.productionCapacity;
  }

  /**
   * Get a summary of the economy's current state
   * @returns {Object} Economy summary
   */
  getSummary() {
    return {
      industrialValue: this.industrialValue,
      techLevel: this.techLevel,
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
    this.industrialValue = 0;
    this.techLevel = 0;
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
      industrialValue: this.industrialValue,
      techLevel: this.techLevel
    });
  }
} 