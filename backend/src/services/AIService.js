/**
 * AIService - Orchestrates AI turn execution
 * Manages AI instantiation, game state fetching, and turn execution
 */

import { pool } from '../db/pool.js';
import { aiRegistry } from '../ai/index.js';
import { filterGameStateForPlayer } from '../ai/utils/gameStateFilter.js';

export class AIService {
  /**
   * Execute AI turn for a specific player
   * @param {string} gameId - Game ID
   * @param {string} playerId - Player ID
   * @returns {Promise<Object>} Result object with success status
   */
  async executeAITurn(gameId, playerId) {
    console.log(`🤖 AIService: Executing AI turn for player ${playerId} in game ${gameId}`);
    
    try {
      // Fetch player data
      const { rows: players } = await pool.query(
        `SELECT id, name, status, meta FROM game_player WHERE game_id = $1 AND id = $2`,
        [gameId, playerId]
      );
      
      if (players.length === 0) {
        console.error(`❌ AIService: Player ${playerId} not found in game ${gameId}`);
        return { success: false, error: 'Player not found' };
      }
      
      const player = players[0];
      
      // Check if player has an AI assigned
      const meta = typeof player.meta === 'string' ? JSON.parse(player.meta) : (player.meta || {});
      const aiName = meta.main_ai;
      
      if (!aiName) {
        console.log(`⚠️ AIService: Player ${playerId} has no AI assigned (meta.main_ai not set)`);
        return { success: false, error: 'No AI assigned' };
      }
      
      // Check if AI is registered
      if (!aiRegistry.hasAI(aiName)) {
        console.error(`❌ AIService: AI '${aiName}' is not registered`);
        return { success: false, error: `AI '${aiName}' not found` };
      }
      
      // Get AI configuration from meta
      const aiConfig = meta.ai_config || {};
      
      // Instantiate the AI with configuration
      const ai = aiRegistry.createAI(aiName, gameId, playerId, aiConfig);
      
      if (!ai) {
        console.error(`❌ AIService: Failed to instantiate AI '${aiName}'`);
        return { success: false, error: 'Failed to instantiate AI' };
      }
      
      // Fetch game state
      const gameState = await this.fetchGameState(gameId);
      
      if (!gameState) {
        console.error(`❌ AIService: Failed to fetch game state`);
        return { success: false, error: 'Failed to fetch game state' };
      }
      
      // Filter game state for this player
      const filteredState = filterGameStateForPlayer(gameState, playerId);
      
      // Execute AI turn
      console.log(`🤖 AIService: Executing turn for AI '${aiName}' (player ${player.name})`);
      await ai.takeTurn(filteredState);
      
      console.log(`✅ AIService: AI turn completed successfully for ${player.name}`);
      
      return {
        success: true,
        playerId,
        playerName: player.name,
        aiName
      };
      
    } catch (error) {
      console.error(`❌ AIService: Error executing AI turn for player ${playerId}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Execute AI turns for all AI players in a game
   * @param {string} gameId - Game ID
   * @returns {Promise<Object>} Result object with execution summary
   */
  async executeAllAITurns(gameId) {
    console.log(`🤖 AIService: Executing all AI turns for game ${gameId}`);
    
    try {
      // Find all players with AI assigned
      const { rows: aiPlayers } = await pool.query(
        `SELECT id, name, meta FROM game_player 
         WHERE game_id = $1 
         AND status = 'active'
         AND meta->>'main_ai' IS NOT NULL
         AND meta->>'main_ai' != ''`,
        [gameId]
      );
      
      console.log(`🤖 AIService: Found ${aiPlayers.length} AI players to execute`);
      
      if (aiPlayers.length === 0) {
        return {
          success: true,
          playersProcessed: 0,
          results: []
        };
      }
      
      // Execute each AI turn
      const results = [];
      for (const player of aiPlayers) {
        const result = await this.executeAITurn(gameId, player.id);
        results.push(result);
        
        // Mark AI player as waiting after submitting orders (same as human players)
        if (result.success) {
          try {
            const { rows } = await pool.query(
              `UPDATE game_player 
               SET status = 'waiting'
               WHERE game_id = $1 AND id = $2
               RETURNING id, name`,
              [gameId, player.id]
            );
            console.log(`🤖 AIService: Marked AI player ${player.name} as waiting`);
          } catch (updateError) {
            console.error(`❌ AIService: Error marking AI player as waiting:`, updateError);
          }
        }
        
        // Add a small delay between AI executions to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;
      
      console.log(`🤖 AIService: Completed ${successCount} successful, ${failureCount} failed AI turns`);
      
      return {
        success: true,
        playersProcessed: results.length,
        successful: successCount,
        failed: failureCount,
        results
      };
      
    } catch (error) {
      console.error(`❌ AIService: Error executing all AI turns for game ${gameId}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error',
        playersProcessed: 0,
        results: []
      };
    }
  }

  /**
   * Fetch complete game state from database
   * @param {string} gameId - Game ID
   * @returns {Promise<Object|null>} Game state or null if error
   */
  async fetchGameState(gameId) {
    try {
      // Get stars
      const { rows: stars } = await pool.query(
        `SELECT * FROM star WHERE game_id = $1 ORDER BY star_id`,
        [gameId]
      );
      
      // Get wormholes
      const { rows: wormholes } = await pool.query(
        `SELECT * FROM wormhole WHERE game_id = $1 ORDER BY id`,
        [gameId]
      );
      
      // Get star states
      const { rows: starStates } = await pool.query(
        `SELECT * FROM star_state WHERE game_id = $1 ORDER BY star_id`,
        [gameId]
      );
      
      // Get ships
      const { rows: ships } = await pool.query(
        `SELECT * FROM ship WHERE game_id = $1 ORDER BY id`,
        [gameId]
      );
      
      // Get players
      const { rows: players } = await pool.query(
        `SELECT * FROM game_player WHERE game_id = $1 ORDER BY name`,
        [gameId]
      );
      
      // Get game info
      const { rows: games } = await pool.query(
        `SELECT map_size, seed, density_min, density_max FROM game WHERE id = $1`,
        [gameId]
      );
      
      const gameInfo = games.length > 0 ? games[0] : {
        map_size: 5,
        seed: 'default',
        density_min: 3,
        density_max: 7
      };
      
      return {
        stars,
        wormholes,
        starStates,
        ships,
        players,
        gameInfo
      };
      
    } catch (error) {
      console.error(`❌ AIService: Error fetching game state for game ${gameId}:`, error);
      return null;
    }
  }
}

