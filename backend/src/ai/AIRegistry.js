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
   * @param {Object} config - Optional configuration object for the AI
   * @returns {BaseAI|null} AI instance or null if not found
   */
  createAI(name, gameId, playerId, config = {}) {
    const AIClass = this.getAI(name);
    if (!AIClass) {
      console.error(`❌ AIRegistry: AI '${name}' not found`);
      return null;
    }

    try {
      const aiInstance = new AIClass(gameId, playerId, config);
      return aiInstance;
    } catch (error) {
      console.error(`❌ AIRegistry: Failed to instantiate AI '${name}':`, error);
      return null;
    }
  }

  /**
   * Get configuration schema for an AI
   * @param {string} name - The AI name
   * @returns {Object|null} Configuration schema or null if not found
   */
  getAISchema(name) {
    const AIClass = this.getAI(name);
    if (!AIClass) {
      return null;
    }

    try {
      return AIClass.getConfigSchema();
    } catch (error) {
      console.error(`❌ AIRegistry: Failed to get schema for AI '${name}':`, error);
      return null;
    }
  }

  /**
   * Get description for an AI
   * @param {string} name - The AI name
   * @returns {string|null} Description or null if not found
   */
  getAIDescription(name) {
    const AIClass = this.getAI(name);
    if (!AIClass) {
      return null;
    }

    try {
      return AIClass.getDescription();
    } catch (error) {
      console.error(`❌ AIRegistry: Failed to get description for AI '${name}':`, error);
      return null;
    }
  }

  /**
   * Get list of available AIs with their schemas and descriptions
   * @returns {Array<Object>} Array of AI info objects
   */
  listAIsWithInfo() {
    const aiNames = this.listAvailableAIs();
    return aiNames.map(name => {
      const schema = this.getAISchema(name);
      const description = this.getAIDescription(name);
      return {
        name,
        schema,
        description
      };
    });
  }
}

// Export a singleton instance
export const aiRegistry = new AIRegistry();

