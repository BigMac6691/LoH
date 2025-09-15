/**
 * TurnService - Business logic for turn management
 * Handles turn state changes and player status updates
 */
import { pool } from '../db/pool.js';

export class TurnService
{
  /**
   * End a player's turn by updating their status to "waiting"
   * @param {string} gameId - Game ID
   * @param {string} playerId - Player ID
   * @returns {Promise<Object>} Result object with success status and updated player info
   */
  async endPlayerTurn(gameId, playerId)
  {
    console.log(`🔄 TurnService: Ending turn for player ${playerId} in game ${gameId}`);
    
    try
    {
      // Update the player's status to "waiting"
      const { rows } = await pool.query(
        `UPDATE game_player 
         SET status = 'waiting'
         WHERE game_id = $1 AND id = $2
         RETURNING *`,
        [gameId, playerId]
      );

      if (rows.length === 0)
      {
        throw new Error(`Player ${playerId} not found in game ${gameId}`);
      }

      const updatedPlayer = rows[0];
      
      console.log(`🔄 TurnService: Player ${playerId} status updated to waiting`);
      
      return {
        success: true,
        player: updatedPlayer,
        message: `Player ${updatedPlayer.name} has ended their turn`
      };

    }
    catch (error)
    {
      console.error('🔄 TurnService: Error ending player turn:', error);
      throw error;
    }
  }

  /**
   * Get all players and their current turn status for a game
   * @param {string} gameId - Game ID
   * @returns {Promise<Array>} Array of players with their status
   */
  async getPlayersTurnStatus(gameId)
  {
    console.log(`🔄 TurnService: Getting turn status for all players in game ${gameId}`);
    
    try
    {
      const { rows } = await pool.query(
        `SELECT id, name, color_hex, status
         FROM game_player 
         WHERE game_id = $1
         ORDER BY name`,
        [gameId]
      );

      console.log(`🔄 TurnService: Found ${rows.length} players in game ${gameId}`);
      
      return rows;

    }
    catch (error)
    {
      console.error('🔄 TurnService: Error getting players turn status:', error);
      throw error;
    }
  }

  /**
   * Reset all players to "active" status (for new turn)
   * @param {string} gameId - Game ID
   * @returns {Promise<Object>} Result object with success status
   */
  async resetPlayersForNewTurn(gameId)
  {
    console.log(`🔄 TurnService: Resetting all players to active status for game ${gameId}`);
    
    try
    {
      const { rows } = await pool.query(
        `UPDATE game_player 
         SET status = 'active'
         WHERE game_id = $1
         RETURNING id, name, status`,
        [gameId]
      );

      console.log(`🔄 TurnService: Reset ${rows.length} players to active status`);
      
      return {
        success: true,
        playersUpdated: rows.length,
        players: rows
      };

    }
    catch (error)
    {
      console.error('🔄 TurnService: Error resetting players for new turn:', error);
      throw error;
    }
  }
}
