/**
 * Development Scenarios - Test data and scenarios for development mode
 * This file contains all test logic and should not be included in production builds
 */

import { eventBus } from './eventBus.js';
import { Ship } from '../../shared/Ship.js';

// Development mode flag
export const DEV_MODE = true; // Set to false for production

/**
 * Default map configuration for development testing
 */
export const DEFAULT_MAP_CONFIG = {
  mapSize: 5,
  minStarDensity: 3,
  maxStarDensity: 7,
  seed: 12345
};

/**
 * Default player configurations for development testing
 */
export const DEFAULT_PLAYERS = [
  {
    name: 'Player 1',
    color: '#ff4444',
    ai: false
  },
  {
    name: 'Player 2', 
    color: '#4444ff',
    ai: true
  }
];

/**
 * Generate a development scenario with default values
 * @param {Object} playerManager - Player manager instance
 * @param {Object} mapModel - Map model instance
 * @returns {Array} Array of configured players
 */
export function generateDevScenario(playerManager, mapModel) {
  console.log('🔧 DEV MODE: Generating development scenario...');
  
  // Clear any existing players
  playerManager.clearPlayers();
  
  // Add default players
  DEFAULT_PLAYERS.forEach((playerConfig, index) => {
    const result = playerManager.addPlayer(
      playerConfig.name,
      playerConfig.color,
      mapModel,
      playerConfig.ai
    );
    
    if (result.success) {
      console.log(`🔧 DEV MODE: Created player ${result.player.name} in sector (${result.player.sector.row + 1}, ${result.player.sector.col + 1})`);
    } else {
      console.error(`🔧 DEV MODE: Failed to create player ${playerConfig.name}:`, result.error);
    }
  });
  
  const players = playerManager.getPlayers();
  console.log(`🔧 DEV MODE: Created ${players.length} players for testing`);
  
  // Add test ships to players' stars
  players.forEach((player, index) => {
    if (player.star) {
      // Add 2-3 ships to each player's star
      const shipCount = 12 + (index % 2); // 2 ships for player 1, 3 for player 2
      
      for (let i = 0; i < shipCount; i++) {
        const ship = new Ship({
          id: `ship_${player.name}_${i}`,
          power: 50 + 10 * (i % 3), // Varying power levels
          damage: Math.random() > 0.5 ? Math.floor(Math.random() * 49) : 0, // Random damage
          owner: player,
          location: player.star
        });
        
        player.star.addShip(ship);
        console.log(`🔧 DEV MODE: Added ship ${ship.id} to ${player.name}'s star`);
      }
      
      // Ship indicators will be created during game start event when map generator is available
    }
  });
  
  return players;
}

/**
 * Set up development mode event listeners
 * @param {Object} playerManager - Player manager instance
 */
export function setupDevModeEventListeners(playerManager) {
  if (!DEV_MODE) return;
  
  console.log('🔧 DEV MODE: Setting up event listeners...');
  
  // Listen for map ready event
  eventBus.once('map:ready', (mapModel) => {
    console.log('🔧 DEV MODE: Map ready, generating test players...');
    const players = generateDevScenario(playerManager, mapModel);

    // make sure there is a connection between the two players
    players[0].star.getConnectedStars()[0].assignOwner(players[1]);
    
    // Update star colors after ownership change
    if (window.mapGenerator) {
      window.mapGenerator.updateStarColors(players);
    }
    
    // Emit players ready event
    eventBus.emit('players:ready', players);
  });
  
  // Listen for players ready event
  eventBus.once('players:ready', (players) => {
    console.log('🔧 DEV MODE: Players ready, starting game...');
    
    // Emit game start event
    eventBus.emit('game:start', players);
  });
  
  // Ship indicators are now created in the main onGameStart function
}

/**
 * Skip setup screens and auto-generate map and players
 * @param {Function} generateMap - Map generation function
 */
export function autoStartDevMode(generateMap) {
  if (!DEV_MODE) {
    console.log('DEV_MODE is disabled - using normal setup flow');
    return;
  }
  
  console.log('🔧 DEV MODE: Auto-starting development scenario...');
  
  // Generate map with default config
  generateMap(DEFAULT_MAP_CONFIG);
}

/**
 * Get development mode status
 * @returns {boolean} True if development mode is enabled
 */
export function isDevMode() {
  return DEV_MODE;
}

/**
 * Log development mode status
 */
export function logDevModeStatus() {
  if (DEV_MODE) {
    console.log('🔧 DEV MODE: Enabled - skipping setup screens and using default values');
    console.log('🔧 DEV MODE: Map config:', DEFAULT_MAP_CONFIG);
    console.log('🔧 DEV MODE: Players:', DEFAULT_PLAYERS);
    
    // Add dev mode info to window for debugging
    window.devMode = {
      enabled: true,
      config: DEFAULT_MAP_CONFIG,
      players: DEFAULT_PLAYERS,
      restart: () => {
        console.log('🔧 DEV MODE: Restarting development scenario...');
        location.reload();
      },
      status: () => {
        console.log('🔧 DEV MODE: Status:', getDevModeStatus());
        return getDevModeStatus();
      },
      toggle: toggleDevMode,
      events: () => {
        console.log('🔧 DEV MODE: Available events: map:ready, players:ready, game:start');
        return ['map:ready', 'players:ready', 'game:start'];
      }
    };
    
    console.log('🔧 DEV MODE: Debug tools available at window.devMode');
    console.log('🔧 DEV MODE: Try window.devMode.status() or window.devMode.restart()');
  } else {
    console.log('🔧 DEV MODE: Disabled - using normal game flow');
  }
}

/**
 * Get current development mode configuration
 * @returns {Object} Current dev mode settings
 */
export function getDevModeConfig() {
  return {
    enabled: DEV_MODE,
    mapConfig: DEFAULT_MAP_CONFIG,
    players: DEFAULT_PLAYERS
  };
}

/**
 * Toggle development mode (for runtime switching)
 */
export function toggleDevMode() {
  // This would require a page reload to take effect
  console.log('🔧 DEV MODE: Toggle requires page reload. Current state:', DEV_MODE);
  console.log('🔧 DEV MODE: To change, edit DEV_MODE in devScenarios.js and reload');
}

/**
 * Get development mode status for debugging
 */
export function getDevModeStatus() {
  return {
    enabled: DEV_MODE,
    mapConfig: DEFAULT_MAP_CONFIG,
    players: DEFAULT_PLAYERS,
    eventBus: window.eventBus ? 'Available' : 'Not available',
    mapGenerator: window.mapGenerator ? 'Available' : 'Not available'
  };
} 