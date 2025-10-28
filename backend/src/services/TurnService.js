/**
 * TurnService - Business logic for turn management
 * Handles turn state changes and player status updates
 */
import { pool } from '../db/pool.js';
import crypto from 'crypto';

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
      
      // Get the current turn ID
      const { rows: currentTurn } = await pool.query(
        `SELECT id FROM game_turn 
         WHERE game_id = $1 AND status = 'open'
         ORDER BY number DESC LIMIT 1`,
        [gameId]
      );

      if (currentTurn.length === 0)
      {
        console.warn(`🔄 TurnService: No open turn found for game ${gameId}`);
        return {
          success: true,
          player: updatedPlayer,
          message: `Player ${updatedPlayer.name} has ended their turn`,
          allPlayersWaiting: false
        };
      }

      const turnId = currentTurn[0].id;
      
      // With simplified orders schema, orders are already final when created
      // No need to finalize orders anymore
      console.log(`🔄 TurnService: Orders are already final in simplified schema`);
      
      // Check if all players are now waiting
      const { rows: allPlayers } = await pool.query(
        `SELECT status FROM game_player WHERE game_id = $1`,
        [gameId]
      );

      const allWaiting = allPlayers.every(player => player.status === 'waiting');
      
      if (allWaiting)
      {
        console.log(`🔄 TurnService: All players are waiting, processing orders for game ${gameId}`);
        
        // Process build orders
        const buildResults = await this.processBuildOrders(gameId, turnId);
        console.log(`🏗️ TurnService: Build orders processed:`, buildResults.results);
        
        // Process expansion orders
        const expansionResults = await this.processExpansionOrders(gameId, turnId);
        console.log(`🏗️ TurnService: Expansion orders processed:`, expansionResults.results);
        
        // TODO: Add other order processing here (moves, combat, etc.)
      }
      
      return {
        success: true,
        player: updatedPlayer,
        message: `Player ${updatedPlayer.name} has ended their turn`,
        allPlayersWaiting: allWaiting
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

  /**
   * Process build orders for a turn
   * @param {string} gameId - Game ID
   * @param {string} turnId - Turn ID
   * @returns {Promise<Object>} Result object with build processing results
   */
  async processBuildOrders(gameId, turnId)
  {
    console.log(`🏗️ TurnService: Processing build orders for game ${gameId}, turn ${turnId}`);
    
    try
    {
      // Get all build orders with star state information
      const { rows: buildOrders } = await pool.query(
        `SELECT 
           o.payload,
           ss.id as star_state_id,
           ss.star_id,
           ss.owner_player,
           ss.economy,
           ss.damage
         FROM orders o
         JOIN star_state ss ON o.payload->>'sourceStarId' = ss.star_id
         WHERE o.game_id = $1 
           AND o.turn_id = $2
           AND o.order_type = 'build'
           AND ss.game_id = $1`,
        [gameId, turnId]
      );

      console.log(`🏗️ TurnService: Found ${buildOrders.length} build orders to process`);

      const results = {
        totalOrders: buildOrders.length,
        shipsBuilt: 0,
        totalSpent: 0,
        errors: []
      };

      // Process each build order
      for (const order of buildOrders)
      {
        try
        {
          const payload = order.payload;
          const economy = order.economy;
          const available = economy.available || 0;
          const technology = economy.technology || 1;
          const shipCost = technology;
          const requestedShips = payload.ships || 1;

          console.log(`🏗️ TurnService: Processing build order for star ${order.star_id}: available=${available}, tech=${technology}, requested=${requestedShips}`);

          // Calculate how many ships can be built
          const maxShips = Math.floor(available / shipCost);
          const shipsToBuild = Math.min(requestedShips, maxShips);
          const totalCost = shipsToBuild * shipCost;

          if (shipsToBuild > 0)
          {
            // Create ships
            for (let i = 0; i < shipsToBuild; i++)
            {
              const shipId = crypto.randomUUID();
              await pool.query(
                `INSERT INTO ship (id, game_id, owner_player, location_star_id, hp, power, status, details)
                 VALUES ($1, $2, $3, $4, $5, $6, 'active', '{}')`,
                [shipId, gameId, order.owner_player, order.star_id, technology, technology]
              );
            }

            // Update available economy
            const newAvailable = available - totalCost;
            const updatedEconomy = { ...economy, available: newAvailable };
            
            await pool.query(
              `UPDATE star_state 
               SET economy = $1, updated_at = now()
               WHERE id = $2`,
              [JSON.stringify(updatedEconomy), order.star_state_id]
            );

            results.shipsBuilt += shipsToBuild;
            results.totalSpent += totalCost;

            console.log(`🏗️ TurnService: Built ${shipsToBuild} ships at star ${order.star_id}, spent ${totalCost}, remaining available: ${newAvailable}`);
          }
          else
          {
            console.log(`🏗️ TurnService: Insufficient funds for star ${order.star_id} (available: ${available}, cost per ship: ${shipCost})`);
          }
        }
        catch (error)
        {
          console.error(`🏗️ TurnService: Error processing build order for star ${order.star_id}:`, error);
          results.errors.push({
            starId: order.star_id,
            error: error.message
          });
        }
      }

      console.log(`🏗️ TurnService: Build processing complete - ${results.shipsBuilt} ships built, ${results.totalSpent} total spent`);
      
      return {
        success: true,
        results
      };

    }
    catch (error)
    {
      console.error('🏗️ TurnService: Error processing build orders:', error);
      throw error;
    }
  }

  /**
   * Process expansion orders for a turn
   * @param {string} gameId - Game ID
   * @param {string} turnId - Turn ID
   * @returns {Promise<Object>} Result object with expansion processing results
   */
  async processExpansionOrders(gameId, turnId)
  {
    console.log(`🏗️ TurnService: Processing expansion orders for game ${gameId}, turn ${turnId}`);
    
    try
    {
      // Get all expansion orders with star state information
      const { rows: expansionOrders } = await pool.query(
        `SELECT 
           o.payload,
           ss.id as star_state_id,
           ss.star_id,
           ss.owner_player,
           ss.economy
         FROM orders o
         JOIN star_state ss ON o.payload->>'sourceStarId' = ss.star_id
         WHERE o.game_id = $1 
           AND o.turn_id = $2
           AND o.order_type = 'build'
           AND ss.game_id = $1`,
        [gameId, turnId]
      );

      console.log(`🏗️ TurnService: Found ${expansionOrders.length} expansion orders to process`);

      const results = {
        totalOrders: expansionOrders.length,
        starsExpanded: 0,
        totalSpent: 0,
        errors: []
      };

      // Process each expansion order
      for (const order of expansionOrders)
      {
        try
        {
          const payload = order.payload;
          const expandAmount = payload.expand || 0;
          const economy = order.economy;
          const available = economy.available || 0;
          const currentIndustry = economy.industry || 0;

          console.log(`🏗️ TurnService: Processing expansion order for star ${order.star_id}: available=${available}, expand=${expandAmount}, currentIndustry=${currentIndustry}`);

          // Calculate how much expansion can be done
          const expansionAmount = Math.min(expandAmount, available);

          if (expansionAmount > 0)
          {
            // Calculate new industry value incrementally for each unit spent
            // Formula: sqrt(1 + currentIndustry) - 1
            let newIndustry = currentIndustry + Math.sqrt(1 + expandAmount) - 1;
            
            // Round to two decimal places
            const roundedIndustry = Math.round(newIndustry * 100) / 100;
            
            // Update industry and available economy
            const updatedEconomy = { 
              ...economy, 
              industry: roundedIndustry,
              available: available - expansionAmount
            };
            
            await pool.query(
              `UPDATE star_state 
               SET economy = $1, updated_at = now()
               WHERE id = $2`,
              [JSON.stringify(updatedEconomy), order.star_state_id]
            );

            results.starsExpanded += 1;
            results.totalSpent += expansionAmount;

            console.log(`🏗️ TurnService: Expanded industry at star ${order.star_id} from ${currentIndustry} to ${roundedIndustry}, spent ${expansionAmount}, remaining available: ${updatedEconomy.available}`);
          }
          else
          {
            console.log(`🏗️ TurnService: No expansion funds for star ${order.star_id} (available: ${available}, requested: ${expandAmount})`);
          }
        }
        catch (error)
        {
          console.error(`🏗️ TurnService: Error processing expansion order for star ${order.star_id}:`, error);
          results.errors.push({
            starId: order.star_id,
            error: error.message
          });
        }
      }

      console.log(`🏗️ TurnService: Expansion processing complete - ${results.starsExpanded} stars expanded, ${results.totalSpent} total spent`);
      
      return {
        success: true,
        results
      };

    }
    catch (error)
    {
      console.error('🏗️ TurnService: Error processing expansion orders:', error);
      throw error;
    }
  }
}
