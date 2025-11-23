/**
 * AI Module - Main entry point for AI system
 * Registers all AI implementations and exports the registry
 */

import { aiRegistry } from './AIRegistry.js';
import { RandyAI } from './randy/index.js';

// Register all AI implementations
aiRegistry.registerAI('Randy', RandyAI);

export { aiRegistry };
export { BaseAI } from './BaseAI.js';

// Export AI implementations for direct use if needed
export { RandyAI } from './randy/index.js';

