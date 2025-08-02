/**
 * SeededRandom - A deterministic pseudorandom number generator
 * Uses xorshift algorithm for fast, repeatable random numbers
 */
class SeededRandom {
  constructor(seed = 1) {
    this.seed = this._validateSeed(seed);
  }

  /**
   * Validate and normalize the seed value
   * @param {number} seed - The seed value
   * @returns {number} - Normalized seed value
   */
  _validateSeed(seed) {
    if (typeof seed !== 'number' || !Number.isFinite(seed)) {
      throw new Error('Seed must be a finite number');
    }
    
    // Convert to 32-bit unsigned integer
    return (seed >>> 0);
  }

  /**
   * Generate next random number using xorshift algorithm
   * @returns {number} - Random number between 0 and 1
   */
  _next() {
    // xorshift algorithm
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >>> 17;
    this.seed ^= this.seed << 5;
    
    // Return normalized value between 0 and 1
    return (this.seed >>> 0) / 0xffffffff;
  }

  /**
   * Generate a random float between min and max (inclusive)
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} - Random float between min and max
   */
  nextFloat(min = 0, max = 1) {
    if (typeof min !== 'number' || typeof max !== 'number') {
      throw new Error('min and max must be numbers');
    }
    
    if (min > max) {
      [min, max] = [max, min]; // Swap if min > max
    }
    
    return min + (this._next() * (max - min));
  }

  /**
   * Generate a random integer between min and max (inclusive)
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} - Random integer between min and max
   */
  nextInt(min = 0, max = 1) {
    if (typeof min !== 'number' || typeof max !== 'number') {
      throw new Error('min and max must be numbers');
    }
    
    // Ensure min and max are integers
    min = Math.floor(min);
    max = Math.floor(max);
    
    if (min > max) {
      [min, max] = [max, min]; // Swap if min > max
    }
    
    // Use inclusive range
    return min + Math.floor(this._next() * (max - min + 1));
  }

  /**
   * Generate a random boolean
   * @param {number} probability - Probability of true (0 to 1), defaults to 0.5
   * @returns {boolean} - Random boolean
   */
  nextBoolean(probability = 0.5) {
    if (typeof probability !== 'number' || probability < 0 || probability > 1) {
      throw new Error('probability must be a number between 0 and 1');
    }
    
    return this._next() < probability;
  }

  /**
   * Pick a random element from an array
   * @param {Array} array - Array to pick from
   * @returns {*} - Random element from the array
   */
  pick(array) {
    if (!Array.isArray(array) || array.length === 0) {
      throw new Error('array must be a non-empty array');
    }
    
    const index = this.nextInt(0, array.length - 1);
    return array[index];
  }

  /**
   * Shuffle an array using Fisher-Yates algorithm
   * @param {Array} array - Array to shuffle
   * @returns {Array} - New shuffled array (original is not modified)
   */
  shuffle(array) {
    if (!Array.isArray(array)) {
      throw new Error('array must be an array');
    }
    
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
  }

  /**
   * Reset the generator to its initial state
   * @param {number} seed - Optional new seed, uses current seed if not provided
   */
  reset(seed = null) {
    this.seed = this._validateSeed(seed !== null ? seed : this.seed);
  }

  /**
   * Get the current seed value
   * @returns {number} - Current seed
   */
  getSeed() {
    return this.seed;
  }

  /**
   * Create a new SeededRandom instance with the same seed
   * @returns {SeededRandom} - New instance with same seed
   */
  clone() {
    return new SeededRandom(this.seed);
  }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SeededRandom;
} else if (typeof window !== 'undefined') {
  window.SeededRandom = SeededRandom;
}

export default SeededRandom; 