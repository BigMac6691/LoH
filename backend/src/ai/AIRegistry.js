/**
 * AIRegistry - Registry pattern for managing AI implementations
 * Maps AI names to AI class constructors for safe instantiation
 */

export class AIRegistry {
  constructor() {
    this.ais = new Map();
  }

  /**
   * Register an AI implementation
   * @param {string} name - Unique name for the AI
   * @param {Class} AIClass - The AI class (must extend BaseAI)
   */
  registerAI(name, AIClass) {
    if (this.ais.has(name)) {
      console.warn(`⚠️ AIRegistry: AI '${name}' already registered, overwriting`);
    }
    
    if (!AIClass || typeof AIClass !== 'function') {
      throw new Error(`AIRegistry: AIClass must be a class constructor`);
    }
    
    this.ais.set(name, AIClass);
    console.log(`✅ AIRegistry: Registered AI '${name}'`);
  }

  /**
   * Get an AI class by name
   * @param {string} name - The AI name
   * @returns {Class|null} The AI class or null if not found
   */
  getAI(name) {
    return this.ais.get(name) || null;
  }

  /**
   * Check if an AI is registered
   * @param {string} name - The AI name
   * @returns {boolean} True if registered
   */
  hasAI(name) {
    return this.ais.has(name);
  }

  /**
   * List all registered AI names
   * @returns {Array<string>} Array of AI names
   */
  listAvailableAIs() {
    return Array.from(this.ais.keys());
  }

  /**
   * Create an instance of an AI
   * @param {string} name - The AI name
   * @param {string} gameId - The game ID
   * @param {string} playerId - The player ID
   * @returns {BaseAI|null} AI instance or null if not found
   */
  createAI(name, gameId, playerId) {
    const AIClass = this.getAI(name);
    if (!AIClass) {
      console.error(`❌ AIRegistry: AI '${name}' not found`);
      return null;
    }

    try {
      const aiInstance = new AIClass(gameId, playerId);
      return aiInstance;
    } catch (error) {
      console.error(`❌ AIRegistry: Failed to instantiate AI '${name}':`, error);
      return null;
    }
  }
}

// Export a singleton instance
export const aiRegistry = new AIRegistry();

