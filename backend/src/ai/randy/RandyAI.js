import
{
   BaseAI
}
from '../BaseAI.js';
import
{
   getOwnedStars,
   getShipsAtStar,
   getAdjacentStars,
   calculateShipRatio,
   getStarState,
   calculateShipStrength
}
from '../utils/mapAnalysis.js';
import
{
   SeededRandom
}
from '@loh/shared';

export class RandyAI extends BaseAI
{
   /**
    * Get configuration schema for RandyAI
    * @returns {Object} Configuration schema
    * @static
    */
   static getConfigSchema() {
      return {
         aggression: {
            type: 'number',
            min: 0.1,
            max: 5.0,
            step: 0.1,
            default: 1.0,
            label: 'Aggression Level',
            description: 'Controls how likely the AI is to attack enemy stars. Higher values make the AI more aggressive. The AI will only attack if the ratio of friendly ships to enemy ships exceeds this value.'
         },
         buildWeight: {
            type: 'number',
            min: 0,
            max: 1,
            step: 0.01,
            default: 0.33,
            label: 'Build Weight',
            description: 'Raw weight for building ships. This value will be normalized with other weights. Higher values prioritize ship construction over expansion and research.'
         },
         expandWeight: {
            type: 'number',
            min: 0,
            max: 1,
            step: 0.01,
            default: 0.33,
            label: 'Expand Weight',
            description: 'Raw weight for expanding to new stars. This value will be normalized with other weights. Higher values prioritize expansion over building and research.'
         },
         researchWeight: {
            type: 'number',
            min: 0,
            max: 1,
            step: 0.01,
            default: 0.34,
            label: 'Research Weight',
            description: 'Raw weight for research and technology. This value will be normalized with other weights. Higher values prioritize research over building and expansion.'
         }
      };
   }

   /**
    * Get description of RandyAI
    * @returns {string} Description
    * @static
    */
   static getDescription() {
      return 'RandyAI is a weighted random AI that makes decisions based on configurable weights for building, expanding, and research. It uses a seeded random number generator for consistent behavior. The AI prioritizes expansion to unowned stars, attacks enemy stars when it has sufficient advantage, and distributes industry spending based on configured weights.';
   }

   /**
    * Constructor for RandyAI
    * @param {string} gameId - The game ID
    * @param {string} playerId - The player ID
    * @param {Object} config - Optional configuration object
    */
   constructor(gameId, playerId, config = {})
   {
      super(gameId, playerId);
      
      const schema = this.constructor.getConfigSchema();
      
      // Use config values or defaults from schema
      this.aggression = config.aggression ?? schema.aggression.default;
      
      // Create seeded random from hash of gameId and playerId
      const seed = this.hashStrings(gameId, playerId);
      this.random = new SeededRandom(seed);

      // Get weights from config or generate random ones
      let buildWeight = config.buildWeight;
      let expandWeight = config.expandWeight;
      let researchWeight = config.researchWeight;

      // If weights not provided, generate random ones
      if (buildWeight === undefined || expandWeight === undefined || researchWeight === undefined) {
         buildWeight = this.random.nextFloat(0.1, 0.5);
         expandWeight = this.random.nextFloat(0.1, 0.5);
         researchWeight = this.random.nextFloat(0.1, 0.5);
      }

      // Normalize weights to sum to 1 (AI is responsible for normalization)
      const sum = buildWeight + expandWeight + researchWeight;
      if (sum > 0) {
         this.buildWeight = buildWeight / sum;
         this.expandWeight = expandWeight / sum;
         this.researchWeight = researchWeight / sum;
      } else {
         // Fallback to equal weights if all are zero
         this.buildWeight = 0.33;
         this.expandWeight = 0.33;
         this.researchWeight = 0.34;
      }

      this.log(`Initialized with weights: build=${this.buildWeight.toFixed(2)}, expand=${this.expandWeight.toFixed(2)}, research=${this.researchWeight.toFixed(2)}, aggression=${this.aggression.toFixed(2)}`);
   }

   /**
    * Hash two strings into a numeric seed
    * @param {string} str1 - First string
    * @param {string} str2 - Second string
    * @returns {number} Numeric seed
    */
   hashStrings(str1, str2)
   {
      let hash = 0;
      const combined = str1 + str2;

      for (let i = 0; i < combined.length; i++)
      {
         const char = combined.charCodeAt(i);
         hash = ((hash << 5) - hash) + char;
         hash = hash & hash; // Convert to 32-bit integer
      }

      return Math.abs(hash);
   }

   /**
    * Take a turn with weighted random decisions
    * @param {Object} gameState - Filtered game state
    * @returns {Promise<void>}
    */
   async takeTurn(gameState)
   {
      this.log('Starting turn');

      // Get owned stars
      const ownedStars = getOwnedStars(this.playerId, gameState.starStates);
      this.log(`Owned ${ownedStars.length} stars`);

      if (ownedStars.length === 0)
      {
         this.log('No owned stars, skipping turn');
         return;
      }

      // We need to import OrdersService here to avoid circular dependencies
      const
      {
         OrdersService
      } = await import('../../services/OrdersService.js');
      const
      {
         getOpenTurn
      } = await import('../../repos/turnsRepo.js');

      const ordersService = new OrdersService();

      // Get current turn
      const turn = await ordersService.getCurrentTurn(this.gameId);
      if (!turn)
      {
         this.log('No open turn found, skipping');
         return;
      }

      const turnId = turn.id;

      // Process owned stars: weighted random decisions for industry spending
      for (const starState of ownedStars)
      {
         await this.processStarIndustryOrders(
            starState,
            gameState,
            ordersService,
            turnId
         );
      }

      this.log('Processing movement orders');
      // Process movement orders: aggressive expansion
      for (const starState of ownedStars)
      {
         await this.processStarMovementOrders(
            starState,
            gameState,
            ordersService,
            turnId
         );
      }

      this.log('Turn complete');
   }

   /**
    * Process industry orders for a star (build, expand, research)
    * @param {Object} starState - Star state
    * @param {Object} gameState - Game state
    * @param {OrdersService} ordersService - Orders service
    * @param {string} turnId - Turn ID
    * @returns {Promise<void>}
    */
   async processStarIndustryOrders(starState, gameState, ordersService, turnId)
   {
      const economy = starState.economy ||
      {};
      const available = economy.available || 0;

      if (available <= 0)
      {
         return; // No industry points available
      }

      const payload = {
         sourceStarId: starState.star_id,
      };

      for (const action of ['build', 'expand', 'research'])
      {
         switch (action)
         {
            case 'build':
               payload.build = available * this.buildWeight;
               break;
            case 'expand':
               payload.expand = available * this.expandWeight;
               break;
            case 'research':
               payload.research = available * this.researchWeight;
               break;
         }
      }

      try
      {
         await ordersService.createOrder(
         {
            gameId: this.gameId,
            turnId,
            playerId: this.playerId,
            orderType: 'build',
            payload
         });

         this.log(`Issued build order at star ${starState.star_id}: ${JSON.stringify(payload)}`);
      }
      catch (error)
      {
         this.log(`Error issuing build order: ${error.message}`);
      }
   }

   /**
    * Process movement orders for a star
    * @param {Object} starState - Star state
    * @param {Object} gameState - Game state
    * @param {OrdersService} ordersService - Orders service
    * @param {string} turnId - Turn ID
    * @returns {Promise<void>}
    */
   async processStarMovementOrders(starState, gameState, ordersService, turnId)
   {
      this.log('Processing movement orders for star', starState);

      const shipsAtStar = getShipsAtStar(starState.star_id, gameState.ships)
         .filter(ship => ship.owner_player === this.playerId && ship.status === 'active');

      this.log('Ships at star', shipsAtStar.length);
      if (shipsAtStar.length === 0)
      {
         this.log('No ships at this star, skipping');
         return; // No ships at this star
      }

      // Get adjacent stars
      const adjacentStars = getAdjacentStars(starState.star_id, gameState.wormholes);

      this.log('Adjacent stars', adjacentStars);

      if (adjacentStars.length === 0)
      {
         this.log('No adjacent stars, skipping');
         return; // No adjacent stars
      }

      // Track which ships have been used for movement orders
      const usedShipIds = new Set();
      const unmovedShips = () => shipsAtStar.filter(ship => !usedShipIds.has(ship.id));

      // Categorize adjacent stars into unowned and enemy-owned
      const unownedStars = [];
      const enemyStars = [];
      const ownedAdjacentStars = [];

      for (const adjacentStarId of adjacentStars)
      {
         const adjStarState = getStarState(adjacentStarId, gameState.starStates);
         if (!adjStarState || !adjStarState.owner_player)
         {
            // Unowned star
            unownedStars.push(adjacentStarId);
         }
         else if (adjStarState.owner_player !== this.playerId)
         {
            // Enemy-owned star
            enemyStars.push(adjacentStarId);
         }
         else
         {
            // Owned star
            ownedAdjacentStars.push(adjacentStarId);
         }
      }

      this.log(`Found ${unownedStars.length} unowned stars and ${enemyStars.length} enemy stars`);

      // Step 1: Send one ship to each unowned adjacent star (if there are unmoved ships)
      for (const unownedStarId of unownedStars)
      {
         const availableShips = unmovedShips();
         if (availableShips.length === 0)
         {
            break; // No more unmoved ships
         }

         // Send one ship to this unowned star
         const shipToMove = availableShips[0];
         usedShipIds.add(shipToMove.id);

         try
         {
            const payload = {
               sourceStarId: starState.star_id,
               destinationStarId: unownedStarId,
               selectedShipIds: [shipToMove.id]
            };

            await ordersService.createOrder(
            {
               gameId: this.gameId,
               turnId,
               playerId: this.playerId,
               orderType: 'move',
               payload
            });

            this.log(`Issued move order: 1 ship from ${starState.star_id} to unowned star ${unownedStarId}`);
         }
         catch (error)
         {
            this.log(`Error issuing move order to unowned star: ${error.message}`);
            usedShipIds.delete(shipToMove.id); // Release the ship if order failed
         }
      }

      // Step 2: Check enemy-owned stars and attack if ratio > aggression
      for (const enemyStarId of enemyStars)
      {
         const availableShips = unmovedShips();
         if (availableShips.length === 0)
         {
            break; // No more unmoved ships
         }

         // Get enemy ships at this star
         const allShipsAtEnemyStar = getShipsAtStar(enemyStarId, gameState.ships);
         const enemyShips = allShipsAtEnemyStar.filter(
            ship => ship.owner_player !== this.playerId && ship.status === 'active'
         );

         if (enemyShips.length === 0)
         {
            // No enemy ships, treat as unowned (shouldn't happen but handle gracefully)
            continue;
         }

         // Calculate ratio: unmoved ships / enemy ships
         const ratio = availableShips.length / enemyShips.length;

         this.log(`Enemy star ${enemyStarId}: ${availableShips.length} unmoved ships vs ${enemyShips.length} enemy ships (ratio: ${ratio.toFixed(2)})`);

         // Only attack if ratio > aggression
         if (ratio > this.aggression)
         {
            // Attack with ALL unmoved ships
            const shipIdsToMove = availableShips.map(ship => ship.id);
            for (const shipId of shipIdsToMove)
            {
               usedShipIds.add(shipId);
            }

            try
            {
               const payload = {
                  sourceStarId: starState.star_id,
                  destinationStarId: enemyStarId,
                  selectedShipIds: shipIdsToMove
               };

               await ordersService.createOrder(
               {
                  gameId: this.gameId,
                  turnId,
                  playerId: this.playerId,
                  orderType: 'move',
                  payload
               });

               this.log(`Issued attack order: ${shipIdsToMove.length} ships from ${starState.star_id} to enemy star ${enemyStarId} (ratio: ${ratio.toFixed(2)})`);
               break; // Only attack one enemy star per turn
            }
            catch (error)
            {
               this.log(`Error issuing attack order: ${error.message}`);
               // Release ships if order failed
               for (const shipId of shipIdsToMove)
               {
                  usedShipIds.delete(shipId);
               }
            }
         }
         else
         {
            this.log(`Skipping enemy star ${enemyStarId}: ratio ${ratio.toFixed(2)} <= aggression ${this.aggression}`);
         }
      }

      // Step 3: If there are no adjacent enemy stars, move remaining ships randomly
      if (enemyStars.length === 0)
      {
         const availableShips = unmovedShips();
         if (availableShips.length > 0)
         {
            const candidateStars = [...unownedStars, ...ownedAdjacentStars];
            
            if (candidateStars.length === 0)
            {
               // No adjacent stars to move to (shouldn't happen, but handle gracefully)
               return;
            }

            if (!candidateStars.includes(starState.star_id))
            {
               candidateStars.push(starState.star_id);
            }
   

            const destinationShipMap = new Map();

            for (const ship of availableShips)
            {
               const randomIndex = Math.floor(this.random.nextFloat(0, 1) * candidateStars.length);
               const targetStarId = candidateStars[randomIndex];

               if (targetStarId === starState.star_id)
               {
                  this.log(`Keeping ship ${ship.id} at star ${starState.star_id}`);
                  continue;
               }

               usedShipIds.add(ship.id);

               if (!destinationShipMap.has(targetStarId))
               {
                  destinationShipMap.set(targetStarId, []);
               }
               destinationShipMap.get(targetStarId).push(ship.id);
            }

            for (const [destinationStarId, shipIds] of destinationShipMap.entries())
            {
               try
               {
                  const payload = {
                     sourceStarId: starState.star_id,
                     destinationStarId,
                     selectedShipIds: shipIds
                  };

                  await ordersService.createOrder(
                  {
                     gameId: this.gameId,
                     turnId,
                     playerId: this.playerId,
                     orderType: 'move',
                     payload
                  });

                  this.log(`Issued random move order: ${shipIds.length} ship(s) from ${starState.star_id} to ${destinationStarId}`);
               }
               catch (error)
               {
                  this.log(`Error issuing random move order: ${error.message}`);
                  for (const shipId of shipIds)
                  {
                     usedShipIds.delete(shipId);
                  }
               }
            }
         }
      }
   }
}
