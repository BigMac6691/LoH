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
    * Constructor for RandyAI
    * @param {string} gameId - The game ID
    * @param {string} playerId - The player ID
    */
   constructor(gameId, playerId)
   {
      super(gameId, playerId);
      this.aggression = 1.0; // Default aggression level (friendly/enemy ratio threshold)

      // Create seeded random from hash of gameId and playerId
      const seed = this.hashStrings(gameId, playerId);
      this.random = new SeededRandom(seed);

      // Generate random weights for each action type
      const buildWeight = this.random.nextFloat(0.1, 0.5);
      const expandWeight = this.random.nextFloat(0.1, 0.5);
      const researchWeight = this.random.nextFloat(0.1, 0.5);

      // Normalize weights to sum to 1
      const sum = buildWeight + expandWeight + researchWeight;
      this.buildWeight = buildWeight / sum;
      this.expandWeight = expandWeight / sum;
      this.researchWeight = researchWeight / sum;

      this.log(`Initialized with weights: build=${this.buildWeight.toFixed(2)}, expand=${this.expandWeight.toFixed(2)}, research=${this.researchWeight.toFixed(2)}`);
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

      this.log('Ships at star', shipsAtStar);
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

      // Find best target based on aggression threshold
      let bestTarget = null;
      let bestRatio = 0;

      for (const adjacentStarId of adjacentStars)
      {
         const ratio = calculateShipRatio(adjacentStarId, this.playerId, gameState.ships);

         // If ratio is 0, it means no enemy ships (safe target)
         if (ratio === 0)
         {
            bestTarget = adjacentStarId;
            bestRatio = 0;
            break;
         }

         // If ratio exceeds aggression threshold, consider it
         if (ratio >= this.aggression)
         {
            if (ratio > bestRatio)
            {
               bestTarget = adjacentStarId;
               bestRatio = ratio;
            }
         }
      }

      this.log('Best target', bestTarget, bestRatio);
      // If we found a good target, issue move order
      if (bestTarget)
      {
         // Select all ships at this star
         const shipIds = shipsAtStar.map(ship => ship.id);

         try
         {
            const payload = {
               sourceStarId: starState.star_id,
               destinationStarId: bestTarget,
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

            this.log(`Issued move order: ${shipsAtStar.length} ships from ${starState.star_id} to ${bestTarget} (ratio: ${bestRatio.toFixed(2)})`);
         }
         catch (error)
         {
            this.log(`Error issuing move order: ${error.message}`);
         }
      }
   }
}
