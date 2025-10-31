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
import SeededRandom from '../../../packages/shared/src/SeededRandom.js';

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

         // Get the current turn ID
         const
         {
            rows: currentTurn
         } = await pool.query(
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
         const
         {
            rows: allPlayers
         } = await pool.query(
            `SELECT status FROM game_player WHERE game_id = $1`,
            [gameId]
         );

         const allWaiting = allPlayers.every(player => player.status === 'waiting');

         if (allWaiting)
         {
            console.log(`🔄 TurnService: All players are waiting, processing orders for game ${gameId}`);

            // Process move orders first
            const moveResults = await this.processMoveOrders(gameId, turnId);
            console.log(`🚀 TurnService: Move orders processed:`, moveResults);

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
         WHERE game_id = $1 AND turn_id = $2 AND order_type = 'move'`,
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

               if (!sourceStarId || !destinationStarId || shipIds.length === 0)
               {
                  console.warn(`🚀 TurnService: Invalid move order, skipping:`, payload);
                  continue;
               }

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

         // Step 4: Resolve combat at contested stars
         await this.resolveCombat(gameId, turnId);

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

      // Generate seed for this battle
      const battleSeed = this._generateCombatSeed(starId, turnId);
      const rng = new SeededRandom(battleSeed);
      console.log(`⚔️ TurnService: Battle seed: ${battleSeed}`);

      // Capture initial ship state for replayability (before any modifications)
      // Store essential combat attributes - can be expanded with more ship properties later
      const initialShipStates = ships.map(ship => (
      {
         id: ship.id,
         owner_player: ship.owner_player,
         hp: parseFloat(ship.hp),
         power: parseFloat(ship.power),
         // Note: Add more attributes here (status, details, etc.) if needed for replay
         // by updating the SELECT query in resolveCombat() to include them
      }));

      // Sort ships by owner into a map (player_id -> ships array)
      const shipsByPlayer = new Map();
      const playerIds = [];

      for (const ship of ships)
      {
         const playerId = ship.owner_player;
         if (!shipsByPlayer.has(playerId))
         {
            shipsByPlayer.set(playerId, []);
            playerIds.push(playerId);
         }
         // Store ship with current HP for tracking
         shipsByPlayer.get(playerId).push(
         {
            id: ship.id,
            owner_player: ship.owner_player,
            hp: parseFloat(ship.hp),
            power: parseFloat(ship.power),
            destroyed: false
         });
      }

      // Sort player IDs in ascending order for consistent processing order
      playerIds.sort();

      // Track ships lost by player
      const shipsLostByPlayer = new Map();
      for (const playerId of playerIds)
      {
         shipsLostByPlayer.set(playerId, 0);
      }

      // Round loop - continue until only one player has ships or no ships remain
      let round = 0;
      let winner = null;
      let remainingShips = 0;

      while (true)
      {
         round++;
         console.log(`⚔️ TurnService: Round ${round} at star ${starId}`);

         // Check if combat is over
         const playersWithShips = [];
         for (const [playerId, playerShips] of shipsByPlayer.entries())
         {
            const activeShips = playerShips.filter(s => !s.destroyed);
            if (activeShips.length > 0)
            {
               playersWithShips.push(playerId);
            }
         }

         // Combat ends if 0 or 1 players have ships
         if (playersWithShips.length <= 1)
         {
            winner = playersWithShips.length === 1 ? playersWithShips[0] : null;
            console.log(`⚔️ TurnService: Combat ended at round ${round}, winner: ${winner || 'none'}`);

            // Record remaining ships count for the winner
            if (winner)
            {
               const winnerShips = shipsByPlayer.get(winner);
               const activeShips = winnerShips.filter(s => !s.destroyed);
               remainingShips = activeShips.length;
            }
            else
            {
               remainingShips = 0; // No winner means no ships left
            }
            break;
         }

         // Firing phase: collect all attacks first (simultaneous firing)
         const attacks = [];

         for (const attackerPlayerId of playerIds)
         {
            const attackerShips = shipsByPlayer.get(attackerPlayerId).filter(s => !s.destroyed);

            // Get all enemy ships (ships from other players) - snapshot at start of round
            const enemyShips = [];
            for (const enemyPlayerId of playerIds)
            {
               if (enemyPlayerId !== attackerPlayerId)
               {
                  const enemyPlayerShips = shipsByPlayer.get(enemyPlayerId).filter(s => !s.destroyed);
                  enemyShips.push(...enemyPlayerShips);
               }
            }

            // Skip if no attackers or no enemies
            if (attackerShips.length === 0 || enemyShips.length === 0)
            {
               continue;
            }

            // Each attacker ship fires at a random enemy (collect attacks, don't apply yet)
            for (const attacker of attackerShips)
            {
               // Randomly select target from all enemy ships (using snapshot from start of round)
               const targetIndex = rng.nextInt(0, enemyShips.length - 1);
               const defender = enemyShips[targetIndex];

               // Calculate accuracy: attacker power / (attacker power + defender power)
               const accuracy = attacker.power / (attacker.power + defender.power);

               // Determine if hit
               const roll = rng.nextFloat(0, 1);
               const isHit = roll < accuracy;

               let damage = 0;
               if (isHit)
               {
                  // Calculate damage: attacker power * random(0..1)
                  const damageMultiplier = rng.nextFloat(0, 1);
                  damage = attacker.power * damageMultiplier;
               }

               // Store attack to apply after all ships have fired
               attacks.push(
               {
                  attacker: attacker,
                  defender: defender,
                  isHit: isHit,
                  damage: damage,
                  roll: roll,
                  accuracy: accuracy
               });

               console.log(`⚔️ TurnService: Ship ${attacker.id} firing at ship ${defender.id} and ${isHit ? 'hits' : 'misses'}`);
            }
         }

         // Now apply all damage simultaneously
         for (const attack of attacks)
         {
            if (attack.isHit)
            {
               // Apply damage
               attack.defender.hp -= attack.damage;

               console.log(`⚔️ TurnService: Ship ${attack.attacker.id} hits ship ${attack.defender.id} for ${attack.damage.toFixed(2)} damage (HP: ${attack.defender.hp.toFixed(2)})`);

               // Check if ship is destroyed
               if (attack.defender.hp <= 0 && !attack.defender.destroyed)
               {
                  attack.defender.destroyed = true;
                  attack.defender.hp = 0;
                  console.log(`⚔️ TurnService: Ship ${attack.defender.id} destroyed!`);

                  // Track ship loss
                  const currentLosses = shipsLostByPlayer.get(attack.defender.owner_player);
                  shipsLostByPlayer.set(attack.defender.owner_player, currentLosses + 1);
               }
            }
            else
            {
               console.log(`⚔️ TurnService: Ship ${attack.attacker.id} misses ship ${attack.defender.id} (roll: ${attack.roll.toFixed(3)}, accuracy: ${attack.accuracy.toFixed(3)})`);
            }
         }
      }

      // Record combat event
      const combatDetails = {
         starId,
         battleSeed,
         rounds: round,
         winner,
         remainingShips,
         shipsLostByPlayer: Object.fromEntries(shipsLostByPlayer),
         initialShipStates // Complete ship state at battle start for replayability
      };

      // Update ship HP and destroy ships in database
      for (const [playerId, playerShips] of shipsByPlayer.entries())
      {
         for (const ship of playerShips)
         {
            if (ship.destroyed)
            {
               // Mark ship as destroyed (set status to destroyed or delete)
               await pool.query(
                  `UPDATE ship 
                   SET status = 'destroyed', hp = 0
                   WHERE id = $1 AND game_id = $2`,
                  [ship.id, gameId]
               );
            }
            else
            {
               // Update ship HP
               await pool.query(
                  `UPDATE ship 
                   SET hp = $1
                   WHERE id = $2 AND game_id = $3`,
                  [ship.hp, ship.id, gameId]
               );
            }
         }
      }

      // Record combat event for all participants (each player gets their own event)
      for (const playerId of playerIds)
      {
         await this.recordTurnEvent(gameId, turnId, playerId, 'combat', combatDetails);
      }

      return {
         starId,
         battleSeed,
         rounds: round,
         winner,
         remainingShips,
         shipsLostByPlayer: Object.fromEntries(shipsLostByPlayer)
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
           AND o.order_type = 'build'
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
                        remainingAvailable: economy.available
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
                        remainingAvailable: economy.available
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
                        remainingAvailable: economy.available
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

         // Step 4: Reset players for new turn (outside transaction for safety)
         await this.resetPlayersForNewTurn(gameId);

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
