/**
 * TurnService - Business logic for turn management
 * Handles turn state changes and player status updates
 */
import
{
   pool
}
from '../db/pool.js';
import crypto from 'crypto';
import
{
   SpaceCombat
}
from '@loh/shared';
import
{
   AIService
}
from './AIService.js';
import
{
   getOpenTurn
}
from '../repos/turnsRepo.js';
import
{
   StandingOrdersService
}
from './StandingOrdersService.js';

// Create a singleton AIService instance
const aiService = new AIService();

export class TurnService
{
   /**
    * Record a turn event for a specific player
    * @param {string} gameId - Game ID
    * @param {string} turnId - Turn ID
    * @param {string} playerId - Player ID (null for global events)
    * @param {string} kind - Event type (move, combat, production, etc.)
    * @param {Object} details - Event details as JSONB
    * @param {number} seq - Sequence number (auto-assigned if not provided)
    * @returns {Promise<Object>} The recorded event
    */
   async recordTurnEvent(gameId, turnId, playerId, kind, details, seq = null)
   {
      // Auto-assign sequence number if not provided
      let eventSeq = seq;
      if (eventSeq === null)
      {
         const
         {
            rows: maxSeq
         } = await pool.query(
            `SELECT COALESCE(MAX(seq), -1) + 1 as next_seq 
         FROM turn_event 
         WHERE game_id = $1 AND turn_id = $2`,
            [gameId, turnId]
         );
         eventSeq = maxSeq[0].next_seq;
      }

      const eventId = crypto.randomUUID();
      const
      {
         rows
      } = await pool.query(
         `INSERT INTO turn_event (id, game_id, turn_id, player_id, seq, kind, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
         [eventId, gameId, turnId, playerId, eventSeq, kind, JSON.stringify(details)]
      );

      console.log(`📝 TurnService: Recorded ${kind} event for player ${playerId || 'global'}:`, details);
      return rows[0];
   }

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
         const
         {
            rows
         } = await pool.query(
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

         // Get the current turn (full object with id and number)
         const currentTurn = await getOpenTurn(gameId);

         if (!currentTurn)
         {
            console.warn(`🔄 TurnService: No open turn found for game ${gameId}`);
            return {
               success: true,
               player: updatedPlayer,
               message: `Player ${updatedPlayer.name} has ended their turn`,
               allPlayersWaiting: false
            };
         }

         const turnId = currentTurn.id;

         // Check if all HUMAN players are now waiting (exclude AI players)
         const
         {
            rows: humanPlayers
         } = await pool.query(
            `SELECT status FROM game_player 
         WHERE game_id = $1 
         AND (meta->>'main_ai' IS NULL OR meta->>'main_ai' = '')`,
            [gameId]
         );

         const allHumanPlayersWaiting = humanPlayers.every(player => player.status === 'waiting');

         if (allHumanPlayersWaiting)
         {
            console.log("================================================");
            console.log(`🔄 TurnService(${currentTurn.number}): All human players are waiting, executing AI players for game ${gameId}`);
            console.log("================================================");

            // First: Execute all AI players
            try
            {
               const aiResult = await aiService.executeAllAITurns(gameId);
               console.log(`🤖 TurnService: AI execution completed: ${aiResult.successful || 0} successful, ${aiResult.failed || 0} failed`);
            }
            catch (aiError)
            {
               console.error('🤖 TurnService: Error executing AI turns:', aiError);
               // Don't throw - AI errors shouldn't block order processing
            }

            console.log(`🔄 TurnService: Processing turn ${currentTurn.number} for game ${gameId}`);
            console.log(`🔄 TurnService: All players (including AI) have submitted orders, processing for game ${gameId}`);

            // Process move orders first
            const moveResults = await this.processMoveOrders(gameId, turnId);
            console.log(`🚀 TurnService: Move orders processed:`, moveResults);

            // Check for victory/lose conditions
            const victoryResult = await this.checkVictoryConditions(gameId, turnId, playerId);
            if (victoryResult)
            {
               console.log(`🎯 TurnService: Victory condition detected:`, victoryResult);
            }

            // Then process all build orders (build, expand, research) per star
            const buildResults = await this.processAllBuildOrders(gameId, turnId);
            console.log(`🏗️ TurnService: Build orders processed:`, buildResults);

            // Prepare for next turn
            await this.prepareNextTurn(gameId, turnId);
         }

         return {
            success: true,
            player: updatedPlayer,
            message: `Player ${updatedPlayer.name} has ended their turn`,
            allPlayersWaiting: allHumanPlayersWaiting
         };

      }
      catch (error)
      {
         console.error('🔄 TurnService: Error ending player turn:', error);
         throw error;
      }
   }

   /**
    * Check for victory/lose conditions after move orders
    * @param {string} gameId - Game ID
    * @param {string} turnId - Turn ID
    * @param {string} playerId - Current player ID (not needed but kept for compatibility)
    * @returns {Promise<Object|null>} Result object with win/lose info or null
    */
   async checkVictoryConditions(gameId, turnId, playerId)
   {
      console.log(`🎯 TurnService: Checking victory conditions for game ${gameId}`);

      try
      {
         // Query to join game_player with star_state to count stars owned by each active player
         const
         {
            rows: playerStarCounts
         } = await pool.query(
            `SELECT 
          gp.id as player_id,
          gp.name as player_name,
          gp.status,
          COUNT(ss.owner_player)::INTEGER as star_count
         FROM game_player gp
         LEFT JOIN star_state ss ON ss.game_id = gp.game_id AND ss.owner_player = gp.id
         WHERE gp.game_id = $1 AND gp.status IN ('active', 'waiting')
         GROUP BY gp.id, gp.name, gp.status
         ORDER BY star_count DESC`,
            [gameId]
         );

         console.log(`🎯 TurnService: Player star counts:`, playerStarCounts);

         // Check for losers (players with 0 stars who are still active/waiting)
         const losers = playerStarCounts.filter(p => p.star_count === 0);

         console.log(`🎯 TurnService: Losers:`, losers);

         if (losers.length > 0)
         {
            console.log(`🎯 TurnService: Found ${losers.length} player(s) with no stars`);

            // Mark losers and record defeat events
            for (const loser of losers)
            {
               await pool.query(
                  `UPDATE game_player SET status = 'lost' WHERE id = $1`,
                  [loser.player_id]
               );

               await this.recordTurnEvent(gameId, turnId, loser.player_id, 'defeat',
               {
                  reason: 'no_stars_controlled'
               });

               console.log(`🎯 TurnService: Player ${loser.player_name} (${loser.player_id}) marked as lost`);
            }
         }

         // Check for winner (only one player with stars > 0)
         const playersWithStars = playerStarCounts.filter(p => p.star_count > 0);

         if (playersWithStars.length === 1)
         {
            const winner = playersWithStars[0];
            console.log(`🎯 TurnService: Player ${winner.player_name} (${winner.player_id}) has won!`);

            // Mark winner and record victory event
            await pool.query(
               `UPDATE game_player SET status = 'winner' WHERE id = $1`,
               [winner.player_id]
            );

            await this.recordTurnEvent(gameId, turnId, winner.player_id, 'victory',
            {
               reason: 'all_opponents_defeated'
            });

            return {
               winner: winner.player_id,
               loser: null,
               isVictory: true
            };
         }

         return null;
      }
      catch (error)
      {
         console.error('🎯 TurnService: Error checking victory conditions:', error);
         return null;
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
         const
         {
            rows
         } = await pool.query(
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
         const
         {
            rows
         } = await pool.query(
            `UPDATE game_player 
         SET status = 'active'
         WHERE game_id = $1 AND status NOT IN ('lost', 'winner')
         RETURNING id, name, status`,
            [gameId]
         );

         console.log(`🔄 TurnService: Reset ${rows.length} players to active status (excluding lost/winner players)`);

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
    * Process move orders for a turn
    * @param {string} gameId - Game ID
    * @param {string} turnId - Turn ID
    * @returns {Promise<Object>} Result object with move processing results
    */
   async processMoveOrders(gameId, turnId)
   {
      console.log(`🚀 TurnService: Processing move orders for game ${gameId}, turn ${turnId}`);

      try
      {
         // Get all move orders
         const
         {
            rows: moveOrders
         } = await pool.query(
            `SELECT * FROM orders 
         WHERE game_id = $1 AND turn_id = $2 AND order_type IN ('auto_move', 'move')`,
            [gameId, turnId]
         );

         console.log(`🚀 TurnService: Found ${moveOrders.length} move orders to process`);

         const results = {
            totalOrders: moveOrders.length,
            shipsMoved: 0,
            starsCaptured: 0,
            errors: []
         };

         // Step 1: Move all ships to their destination
         for (const order of moveOrders)
         {
            try
            {
               const payload = order.payload;
               const sourceStarId = payload.sourceStarId;
               const destinationStarId = payload.destinationStarId;
               const shipIds = payload.selectedShipIds || [];
               const fromStandingOrder = payload.fromStandingOrder === true;

               if (!sourceStarId || !destinationStarId)
               {
                  console.warn(`🚀 TurnService: Invalid move order (missing source or destination), skipping:`, payload);
                  continue;
               }

               // Handle standing orders: if fromStandingOrder and shipIds is empty, move all ships
               if (fromStandingOrder && shipIds.length === 0)
               {
                  // First, find all ships at the source star that will be moved
                  const
                  {
                     rows: shipsToMove
                  } = await pool.query(
                     `SELECT id FROM ship 
                  WHERE game_id = $1 AND location_star_id = $2 AND status = 'active'`,
                     [gameId, sourceStarId]
                  );

                  const actualShipIds = shipsToMove.map(row => row.id);

                  // Move all ships at the source star
                  const
                  {
                     rowCount
                  } = await pool.query(
                     `UPDATE ship 
                  SET location_star_id = $1
                  WHERE game_id = $2 AND location_star_id = $3 AND status = 'active'`,
                     [destinationStarId, gameId, sourceStarId]
                  );

                  results.shipsMoved += rowCount;
                  console.log(`🚀 TurnService: Moved ${rowCount} ships from ${sourceStarId} to ${destinationStarId} (standing order - all ships)`);
                  console.log(`🚀 TurnService: Ship IDs moved:`, actualShipIds);

                  // Record move event for the player with actual ship IDs
                  await this.recordTurnEvent(gameId, turnId, order.player_id, 'move',
                  {
                     sourceStarId,
                     destinationStarId,
                     shipIds: actualShipIds, // Include actual ship IDs that were moved
                     shipsMoved: rowCount,
                     fromStandingOrder: true
                  });
               }
               else if (shipIds.length > 0)
               {
                  // Normal order: move specific ships
                  // Update ship locations
                  const
                  {
                     rowCount
                  } = await pool.query(
                     `UPDATE ship 
                  SET location_star_id = $1
                  WHERE game_id = $2 AND id = ANY($3::uuid[])`,
                     [destinationStarId, gameId, shipIds]
                  );

                  results.shipsMoved += rowCount;
                  console.log(`🚀 TurnService: Moved ${rowCount} ships from ${sourceStarId} to ${destinationStarId}`);

                  // Record move event for the player
                  await this.recordTurnEvent(gameId, turnId, order.player_id, 'move',
                  {
                     sourceStarId,
                     destinationStarId,
                     shipIds,
                     shipsMoved: rowCount
                  });
               }
               else
               {
                  console.warn(`🚀 TurnService: Invalid move order (no ships specified), skipping:`, payload);
                  continue;
               }
            }
            catch (error)
            {
               console.error(`🚀 TurnService: Error processing move order:`, error);
               results.errors.push(
               {
                  orderId: order.id,
                  error: error.message
               });
            }
         }

         // Step 4: Resolve combat at contested stars
         await this.resolveCombat(gameId, turnId);

         // Step 2: Determine star ownership based on ships at each star
         // After all moves, check which player has ships at each star
         const
         {
            rows: starShips
         } = await pool.query(
            `SELECT location_star_id, owner_player, COUNT(*) as ship_count
         FROM ship
         WHERE game_id = $1 AND status = 'active'
         GROUP BY location_star_id, owner_player
         ORDER BY location_star_id, ship_count DESC`,
            [gameId]
         );

         // Group by star and find the player with the most ships
         const starOwnership = {};
         for (const row of starShips)
         {
            const starId = row.location_star_id;
            if (!starOwnership[starId] || row.ship_count > starOwnership[starId].count)
            {
               starOwnership[starId] = {
                  owner: row.owner_player,
                  count: row.ship_count
               };
            }
         }

         // Step 3: Update star ownership and ensure economy exists
         for (const [starId, ownership] of Object.entries(starOwnership))
         {
            try
            {
               // Check if star_state exists for this star
               const
               {
                  rows: existingStar
               } = await pool.query(
                  `SELECT id, economy, owner_player FROM star_state 
             WHERE game_id = $1 AND star_id = $2`,
                  [gameId, starId]
               );

               if (existingStar.length > 0)
               {
                  const starState = existingStar[0];
                  const currentOwner = starState.owner_player;
                  const economy = starState.economy ||
                  {};

                  // Update owner if changed
                  if (currentOwner !== ownership.owner)
                  {
                     await pool.query(
                        `UPDATE star_state 
                 SET owner_player = $1, updated_at = now()
                 WHERE id = $2`,
                        [ownership.owner, starState.id]
                     );

                     results.starsCaptured += 1;
                     console.log(`🚀 TurnService: Star ${starId} captured by player ${ownership.owner} (${ownership.count} ships)`);

                     // Record star capture event for the capturing player
                     await this.recordTurnEvent(gameId, turnId, ownership.owner, 'star_capture',
                     {
                        starId,
                        previousOwner: currentOwner,
                        newOwner: ownership.owner,
                        shipCount: ownership.count
                     });
                  }

                  // Ensure economy has industry and technology set to 1 if missing
                  if (economy.industry === undefined || economy.technology === undefined)
                  {
                     const updatedEconomy = {
                        ...economy,
                        industry: economy.industry !== undefined ? economy.industry : 1,
                        technology: economy.technology !== undefined ? economy.technology : 1,
                        available: economy.available || 0
                     };

                     await pool.query(
                        `UPDATE star_state 
                 SET economy = $1, updated_at = now()
                 WHERE id = $2`,
                        [JSON.stringify(updatedEconomy), starState.id]
                     );

                     console.log(`🚀 TurnService: Initialized economy for star ${starId}`);
                  }
               }
               else
               {
                  // Create new star_state entry
                  const newEconomy = {
                     industry: 1,
                     technology: 1,
                     available: 0
                  };

                  await pool.query(
                     `INSERT INTO star_state (id, game_id, star_id, owner_player, economy)
               VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
                     [gameId, starId, ownership.owner, JSON.stringify(newEconomy)]
                  );

                  results.starsCaptured += 1;
                  console.log(`🚀 TurnService: Created star_state for star ${starId} owned by player ${ownership.owner}`);

                  // Record star capture event for the capturing player
                  await this.recordTurnEvent(gameId, turnId, ownership.owner, 'star_capture',
                  {
                     starId,
                     previousOwner: "None",
                     newOwner: ownership.owner,
                     shipCount: ownership.count
                  });
               }
            }
            catch (error)
            {
               console.error(`🚀 TurnService: Error updating star ${starId}:`, error);
               results.errors.push(
               {
                  starId,
                  error: error.message
               });
            }
         }

         console.log(`🚀 TurnService: Move processing complete - ${results.shipsMoved} ships moved, ${results.starsCaptured} stars captured`);

         return {
            success: true,
            results
         };

      }
      catch (error)
      {
         console.error('🚀 TurnService: Error processing move orders:', error);
         throw error;
      }
   }

   /**
    * Generate a seed from location_star_id and turn_id for deterministic combat
    * @param {string} starId - Star ID
    * @param {string} turnId - Turn ID
    * @returns {number} Numeric seed value
    */
   _generateCombatSeed(starId, turnId)
   {
      // Combine UUIDs into a hash to create a deterministic seed
      const hash = crypto.createHash('md5').update(`${starId}:${turnId}`).digest('hex');
      // Convert first 8 hex characters to integer
      return parseInt(hash.substring(0, 8), 16);
   }

   /**
    * Resolve combat at a single contested star
    * @param {string} gameId - Game ID
    * @param {string} turnId - Turn ID
    * @param {string} starId - Star ID where combat occurs
    * @param {Array} ships - Array of ships at this star
    * @returns {Promise<Object>} Combat result
    */
   async _resolveCombatAtStar(gameId, turnId, starId, ships)
   {
      console.log(`⚔️ TurnService: Resolving combat at star ${starId} with ${ships.length} ships`);

      // Generate seed for this battle (once, before combat starts)
      const battleSeed = this._generateCombatSeed(starId, turnId);
      console.log(`⚔️ TurnService: Battle seed: ${battleSeed}`);

      // Track ship updates for database
      const shipUpdates = new Map(); // shipId -> { hp, destroyed, hpBefore }
      const playerIds = [];

      // Create SpaceCombat instance
      const combat = new SpaceCombat(starId, turnId, battleSeed, ships);

      console.log(`⚔️ TurnService: Setting up event listeners for combat at star ${starId}`);

      // Listen to combat events and track changes
      combat.on('combat:damage', (event) =>
      {
         console.log(`⚔️ TurnService: Received combat:damage event - Ship ${event.shipId}, HP: ${event.hpBefore} → ${event.hpAfter}, destroyed: ${event.destroyed}`);

         // Track HP changes - if destroyed flag is true, always mark as destroyed
         const existingUpdate = shipUpdates.get(event.shipId);
         shipUpdates.set(event.shipId,
         {
            hp: event.hpAfter,
            destroyed: event.destroyed || (existingUpdate?.destroyed === true), // Preserve destroyed flag
            hpBefore: event.hpBefore
         });

         console.log(`⚔️ TurnService: Updated ship ${event.shipId} tracking - HP: ${event.hpAfter}, destroyed: ${shipUpdates.get(event.shipId).destroyed}`);
      });

      combat.on('combat:shipDestroyed', (event) =>
      {
         console.log(`⚔️ TurnService: Received combat:shipDestroyed event - Ship ${event.shipId} (${event.ownerId}) destroyed in round ${event.round}`);

         // Ensure ship is marked as destroyed (this should override any previous state)
         const update = shipUpdates.get(event.shipId) ||
         {};
         update.destroyed = true;
         update.hp = 0;
         shipUpdates.set(event.shipId, update);

         console.log(`⚔️ TurnService: Marked ship ${event.shipId} as destroyed in tracking map`);
      });

      combat.on('combat:start', (event) =>
      {
         console.log(`⚔️ TurnService: Received combat:start event - ${event.playerIds.length} players, ${event.initialShipStates.length} ships`);

         // Extract player IDs for turn event recording
         playerIds.push(...event.playerIds);

         console.log(`⚔️ TurnService: Tracked player IDs:`, playerIds);
      });

      // Resolve combat (this emits all events)
      const result = combat.resolve();

      console.log(`⚔️ TurnService: Combat resolution complete, processing ${shipUpdates.size} ship update(s)`);

      // Log all tracked updates before applying
      for (const [shipId, update] of shipUpdates.entries())
      {
         console.log(`⚔️ TurnService: Ship ${shipId} update - HP: ${update.hp}, destroyed: ${update.destroyed}, hpBefore: ${update.hpBefore}`);
      }

      // Update ship HP and destroy ships in database
      for (const [shipId, update] of shipUpdates.entries())
      {
         if (update.destroyed)
         {
            console.log(`⚔️ TurnService: Updating database - Ship ${shipId} → status='destroyed', hp=0`);

            // Mark ship as destroyed
            const updateResult = await pool.query(
               `UPDATE ship 
                SET status = 'destroyed', hp = 0
                WHERE id = $1 AND game_id = $2`,
               [shipId, gameId]
            );

            console.log(`⚔️ TurnService: Database update result - Ship ${shipId}: ${updateResult.rowCount} row(s) updated`);

            // Verify the update
            const verifyResult = await pool.query(
               `SELECT id, hp, status FROM ship WHERE id = $1 AND game_id = $2`,
               [shipId, gameId]
            );

            if (verifyResult.rows.length > 0)
            {
               const ship = verifyResult.rows[0];
               console.log(`⚔️ TurnService: Verified ship ${shipId} - HP: ${ship.hp}, status: ${ship.status}`);

               if (ship.status !== 'destroyed' || ship.hp !== 0)
               {
                  console.error(`⚔️ TurnService: ERROR - Ship ${shipId} was not properly updated! Expected: status='destroyed', hp=0. Got: status='${ship.status}', hp=${ship.hp}`);
               }
            }
            else
            {
               console.error(`⚔️ TurnService: ERROR - Ship ${shipId} not found in database after update!`);
            }
         }
         else
         {
            // Safety check: if HP is negative or zero, ship should be destroyed
            if (update.hp <= 0)
            {
               console.error(`⚔️ TurnService: WARNING - Ship ${shipId} has non-positive HP (${update.hp}) but not marked as destroyed! Converting to destroyed status.`);
               update.destroyed = true;
               update.hp = 0;

               // Mark ship as destroyed
               const updateResult = await pool.query(
                  `UPDATE ship 
                   SET status = 'destroyed', hp = 0
                   WHERE id = $1 AND game_id = $2`,
                  [shipId, gameId]
               );

               console.log(`⚔️ TurnService: Database update result (destroyed) - Ship ${shipId}: ${updateResult.rowCount} row(s) updated`);

               // Verify the update
               const verifyResult = await pool.query(
                  `SELECT id, hp, status FROM ship WHERE id = $1 AND game_id = $2`,
                  [shipId, gameId]
               );

               if (verifyResult.rows.length > 0)
               {
                  const ship = verifyResult.rows[0];
                  console.log(`⚔️ TurnService: Verified ship ${shipId} - HP: ${ship.hp}, status: ${ship.status}`);
               }
            }
            else
            {
               console.log(`⚔️ TurnService: Updating database - Ship ${shipId} → hp=${update.hp}`);

               // Update ship HP
               const updateResult = await pool.query(
                  `UPDATE ship 
                   SET hp = $1
                   WHERE id = $2 AND game_id = $3`,
                  [update.hp, shipId, gameId]
               );

               console.log(`⚔️ TurnService: Database update result - Ship ${shipId}: ${updateResult.rowCount} row(s) updated`);
            }
         }
      }

      console.log(`⚔️ TurnService: Completed all database updates for combat at star ${starId}`);

      // Record combat event for all participants (each player gets their own event)
      const combatDetails = {
         starId: result.starId,
         battleSeed: result.battleSeed,
         rounds: result.rounds,
         winner: result.winner,
         remainingShips: result.remainingShips,
         shipsLostByPlayer: result.shipsLostByPlayer,
         initialShipStates: result.initialShipStates // For replayability
      };

      for (const playerId of playerIds)
      {
         await this.recordTurnEvent(gameId, turnId, playerId, 'combat', combatDetails);
      }

      return {
         starId: result.starId,
         battleSeed: result.battleSeed,
         rounds: result.rounds,
         winner: result.winner,
         remainingShips: result.remainingShips,
         shipsLostByPlayer: result.shipsLostByPlayer
      };
   }

   /**
    * Resolve combat at contested stars
    * @param {string} gameId - Game ID
    * @param {string} turnId - Turn ID
    * @returns {Promise<Object>} Result object with combat resolution results
    */
   async resolveCombat(gameId, turnId)
   {
      console.log(`⚔️ TurnService: Resolving combat for game ${gameId}, turn ${turnId}`);

      try
      {
         // Detect contested stars (stars with ships from multiple owners)
         const
         {
            rows: contestedShips
         } = await pool.query(
            `WITH contested AS (
               SELECT location_star_id
               FROM ship
               WHERE game_id = $1 AND status = 'active'
               GROUP BY location_star_id
               HAVING COUNT(DISTINCT owner_player) > 1
            )
            SELECT s.id, s.owner_player, s.location_star_id, s.hp, s.power
            FROM ship s
            JOIN contested c ON c.location_star_id = s.location_star_id
            WHERE s.game_id = $1 AND s.status = 'active'
            ORDER BY s.location_star_id, s.owner_player`,
            [gameId]
         );

         // Group by star
         const combatMap = new Map();
         for (const ship of contestedShips)
         {
            const key = ship.location_star_id;
            if (!combatMap.has(key)) combatMap.set(key, []);
            combatMap.get(key).push(ship);
         }

         if (combatMap.size === 0)
         {
            console.log('⚔️ TurnService: No contested stars detected after moves');
            return {
               success: true,
               contestedStars: 0,
               combatResults: []
            };
         }

         console.log(`⚔️ TurnService: Detected ${combatMap.size} contested star(s) after moves`);

         // Resolve combat at each contested star
         const combatResults = [];
         for (const [starId, ships] of combatMap.entries())
         {
            const result = await this._resolveCombatAtStar(gameId, turnId, starId, ships);
            combatResults.push(result);
         }

         return {
            success: true,
            contestedStars: combatMap.size,
            combatResults
         };

      }
      catch (error)
      {
         console.error('⚔️ TurnService: Error resolving combat:', error);
         throw error;
      }
   }

   /**
    * Process all build orders for a turn (build, expand, research) - optimized per star
    * @param {string} gameId - Game ID
    * @param {string} turnId - Turn ID
    * @returns {Promise<Object>} Result object with all processing results
    */
   async processAllBuildOrders(gameId, turnId)
   {
      console.log(`🏗️ TurnService: Processing all orders for game ${gameId}, turn ${turnId}`);

      try
      {
         // Get all build orders with star state information
         const
         {
            rows: orders
         } = await pool.query(
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
           AND o.order_type IN ('auto_build', 'build')
           AND ss.game_id = $1`,
            [gameId, turnId]
         );

         console.log(`🏗️ TurnService: Found ${orders.length} orders to process`, orders);

         const results = {
            totalOrders: orders.length,
            starsProcessed: 0,
            shipsBuilt: 0,
            starsExpanded: 0,
            starsResearched: 0,
            totalBuildSpent: 0,
            totalExpandSpent: 0,
            totalResearchSpent: 0,
            errors: []
         };

         // Process each star's orders sequentially: build -> expand -> research
         for (const order of orders)
         {
            console.log(`🏗️ TurnService: Processing order payload:`, order.payload);

            try
            {
               const payload = order.payload;
               const economy = {
                  ...order.economy
               }; // Clone economy for this star

               // Build ships first
               if (payload.build && payload.build > 0)
               {
                  const available = economy.available || 0;
                  const technology = economy.technology || 1;
                  const shipCost = technology;
                  const requestedShips = Math.floor(payload.build / shipCost);

                  const maxShips = Math.floor(available / shipCost);
                  const shipsToBuild = Math.min(requestedShips, maxShips);
                  const totalCost = shipsToBuild * shipCost;

                  console.log(`🏗️ TurnService: Ship build=${payload.build}, requested=${requestedShips}, built=${shipsToBuild}, cost=${shipCost}`);

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

                     economy.available = available - totalCost;
                     results.shipsBuilt += shipsToBuild;
                     results.totalBuildSpent += totalCost;

                     console.log(`🏗️ TurnService: Built ${shipsToBuild} ships at star ${order.star_id}, spent ${totalCost}`);

                     // Record ship production event for the player
                     await this.recordTurnEvent(gameId, turnId, order.owner_player, 'build.ships',
                     {
                        starId: order.star_id,
                        shipsBuilt: shipsToBuild,
                        totalCost,
                        shipCost: technology,
                        remainingAvailable: economy.available,
                        fromStandingOrder: payload.fromStandingOrder === true
                     });
                  }
               }

               // Then expand industry
               if (payload.expand && payload.expand > 0)
               {
                  const available = economy.available || 0;
                  const expandAmount = payload.expand || 0;
                  const expansionSpent = Math.min(expandAmount, available);

                  if (expansionSpent > 0)
                  {
                     const currentIndustry = economy.industry || 0;
                     // Formula: currentIndustry + sqrt(1 + expansionSpent) - 1
                     let newIndustry = currentIndustry + Math.sqrt(1 + expansionSpent) - 1;

                     // Round to two decimal places
                     economy.industry = Math.round(newIndustry * 100) / 100;
                     economy.available = available - expansionSpent;

                     results.starsExpanded += 1;
                     results.totalExpandSpent += expansionSpent;

                     console.log(`🏗️ TurnService: Expanded industry at star ${order.star_id} to ${economy.industry}, spent ${expansionSpent}`);

                     // Record industry expansion event for the player
                     await this.recordTurnEvent(gameId, turnId, order.owner_player, 'build.industry',
                     {
                        starId: order.star_id,
                        previousIndustry: currentIndustry,
                        newIndustry: economy.industry,
                        expansionSpent,
                        remainingAvailable: economy.available,
                        fromStandingOrder: payload.fromStandingOrder === true
                     });
                  }
               }

               // Finally research technology
               if (payload.research && payload.research > 0)
               {
                  const available = economy.available || 0;
                  const researchAmount = payload.research || 0;
                  const researchSpent = Math.min(researchAmount, available);

                  if (researchSpent > 0)
                  {
                     const currentTechnology = economy.technology || 1;
                     // Formula: currentTechnology + sqrt(1 + researchSpent) - 1
                     let newTechnology = currentTechnology + Math.sqrt(1 + researchSpent) - 1;

                     // Round to two decimal places
                     economy.technology = Math.round(newTechnology * 100) / 100;
                     economy.available = available - researchSpent;

                     results.starsResearched += 1;
                     results.totalResearchSpent += researchSpent;

                     console.log(`🏗️ TurnService: Researched technology at star ${order.star_id} to ${economy.technology}, spent ${researchSpent}`);

                     // Record technology research event for the player
                     await this.recordTurnEvent(gameId, turnId, order.owner_player, 'build.research',
                     {
                        starId: order.star_id,
                        previousTechnology: currentTechnology,
                        newTechnology: economy.technology,
                        researchSpent,
                        remainingAvailable: economy.available,
                        fromStandingOrder: payload.fromStandingOrder === true
                     });
                  }
               }

               // Update star state with final economy values (single update per star)
               await pool.query(
                  `UPDATE star_state 
               SET economy = $1, updated_at = now()
               WHERE id = $2`,
                  [JSON.stringify(economy), order.star_state_id]
               );

               results.starsProcessed += 1;

               console.log(`🏗️ TurnService: Completed processing for star ${order.star_id}, final available: ${economy.available}`);
            }
            catch (error)
            {
               console.error(`🏗️ TurnService: Error processing orders for star ${order.star_id}:`, error);
               results.errors.push(
               {
                  starId: order.star_id,
                  error: error.message
               });
            }
         }

         console.log(`🏗️ TurnService: Order processing complete - ${results.starsProcessed} stars processed, ${results.shipsBuilt} ships built, ${results.starsExpanded} expanded, ${results.starsResearched} researched`);

         return {
            success: true,
            results
         };

      }
      catch (error)
      {
         console.error('🏗️ TurnService: Error processing all orders:', error);
         throw error;
      }
   }

   /**
    * Prepare for the next turn by closing current turn, creating new turn, and updating economies
    * @param {string} gameId - Game ID
    * @param {string} turnId - Current turn ID to close
    * @returns {Promise<Object>} Result object with next turn information
    */
   async prepareNextTurn(gameId, turnId)
   {
      console.log(`🔄 TurnService: Preparing next turn for game ${gameId}, closing turn ${turnId}`);

      const client = await pool.connect();

      try
      {
         await client.query('BEGIN');

         // Step 1: Close the current turn
         const
         {
            rows: closedTurn
         } = await client.query(
            `UPDATE game_turn 
         SET status = 'closed', closed_at = now()
         WHERE id = $1
         RETURNING *`,
            [turnId]
         );

         if (closedTurn.length === 0)
         {
            throw new Error(`Turn ${turnId} not found`);
         }

         const currentTurnNumber = closedTurn[0].number;
         const nextTurnNumber = currentTurnNumber + 1;

         console.log(`🔄 TurnService: Closed turn ${currentTurnNumber}, preparing turn ${nextTurnNumber}`);

         // Step 2: Create new turn
         const newTurnId = crypto.randomUUID();
         const
         {
            rows: newTurn
         } = await client.query(
            `INSERT INTO game_turn (id, game_id, number, status)
         VALUES ($1, $2, $3, 'open')
         RETURNING *`,
            [newTurnId, gameId, nextTurnNumber]
         );

         console.log(`🔄 TurnService: Created new turn ${nextTurnNumber} with id ${newTurnId}`);

         // Step 3: Update star economies - add industry to available
         const
         {
            rows: stars
         } = await client.query(
            `SELECT id, star_id, economy FROM star_state WHERE game_id = $1`,
            [gameId]
         );

         let starsUpdated = 0;
         for (const star of stars)
         {
            const economy = star.economy;
            const currentAvailable = economy.available || 0;
            const industry = economy.industry || 0;

            // Update available = current available + industry
            const newAvailable = currentAvailable + industry;
            const updatedEconomy = {
               ...economy,
               available: newAvailable
            };

            await client.query(
               `UPDATE star_state 
           SET economy = $1, updated_at = now()
           WHERE id = $2`,
               [JSON.stringify(updatedEconomy), star.id]
            );

            starsUpdated++;
         }

         console.log(`🔄 TurnService: Updated economy for ${starsUpdated} stars (added industry to available)`);

         // Record turn completion event (global, no specific player)
         await this.recordTurnEvent(gameId, turnId, null, 'turn_completion',
         {
            turnNumber: currentTurnNumber,
            nextTurnNumber,
            starsUpdated,
            message: `Turn ${currentTurnNumber} completed, ${starsUpdated} stars updated`
         });

         await client.query('COMMIT');

         // Step 4: Create standing orders for the new turn (outside transaction for safety)
         try
         {
            const standingOrdersService = new StandingOrdersService();
            const standingOrdersResult = await standingOrdersService.createStandingOrdersForNewTurn(gameId, newTurnId);
            console.log(`📋 TurnService: Standing orders created:`, standingOrdersResult);
         }
         catch (error)
         {
            console.error('📋 TurnService: Error creating standing orders:', error);
            // Don't throw - standing orders errors shouldn't block turn progression
         }

         // Step 5: Reset players for new turn (outside transaction for safety)
         await this.resetPlayersForNewTurn(gameId);

         // Step 6: Notify WebSocket clients about turn completion
         try {
            const { webSocketService } = await import('./WebSocketService.js');
            const updateData = {
               newTurnId: newTurn[0].id,
               newTurnNumber: nextTurnNumber,
               previousTurnId: turnId,
               previousTurnNumber: currentTurnNumber
            };
            console.log(`🔌 TurnService: Preparing to notify WebSocket clients for game ${gameId}`);
            console.log(`🔌 TurnService: Previous turn - Number: ${currentTurnNumber}, ID: ${turnId}`);
            console.log(`🔌 TurnService: New turn - Number: ${nextTurnNumber}, ID: ${newTurn[0].id}`);
            console.log(`🔌 TurnService: Sending updateData:`, JSON.stringify(updateData, null, 2));
            
            await webSocketService.notifyGameUpdate(gameId, updateData);
            console.log(`🔌 TurnService: Notified WebSocket clients about turn completion for game ${gameId}`);
         } catch (error) {
            console.error('🔌 TurnService: Error notifying WebSocket clients:', error);
            // Don't throw - WebSocket notification failure shouldn't block turn progression
         }

         return {
            success: true,
            closedTurn: closedTurn[0],
            newTurn: newTurn[0],
            starsUpdated
         };

      }
      catch (error)
      {
         await client.query('ROLLBACK');
         console.error('🔄 TurnService: Error preparing next turn:', error);
         throw error;
      }
      finally
      {
         client.release();
      }
   }
}
