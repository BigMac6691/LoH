import { getStarsWithStandingOrders } from '../repos/starsRepo.js';
import { OrdersService } from './OrdersService.js';

/**
 * StandingOrdersService - Creates regular orders from standing orders at turn start
 */
export class StandingOrdersService
{
   /**
    * Create regular orders from standing orders for a new turn
    * @param {string} gameId - Game ID
    * @param {string} turnId - Turn ID for the new turn
    * @returns {Promise<Object>} Result object with created orders count
    */
   async createStandingOrdersForNewTurn(gameId, turnId)
   {
      console.log(`📋 StandingOrdersService: Creating standing orders for game ${gameId}, turn ${turnId}`);

      try
      {
         // Get all stars with standing orders for this game
         const starsWithStandingOrders = await getStarsWithStandingOrders({ gameId });

         if (starsWithStandingOrders.length === 0)
         {
            console.log(`📋 StandingOrdersService: No stars with standing orders found for game ${gameId}`);
            return {
               success: true,
               ordersCreated: 0,
               starsProcessed: 0
            };
         }

         console.log(`📋 StandingOrdersService: Found ${starsWithStandingOrders.length} stars with standing orders`);

         const ordersService = new OrdersService();
         let ordersCreated = 0;
         let starsProcessed = 0;

         // Process each star with standing orders
         for (const starState of starsWithStandingOrders)
         {
            try
            {
               const standingOrders = starState.details.standingOrders;
               const playerId = starState.owner_player;

               if (!playerId)
               {
                  console.warn(`📋 StandingOrdersService: Star ${starState.star_id} has standing orders but no owner, skipping`);
                  continue;
               }

               starsProcessed++;

               // Process industry standing orders
               if (standingOrders.industry)
               {
                  const industryOrder = await this.createIndustryOrder(
                     gameId,
                     turnId,
                     starState.star_id,
                     playerId,
                     standingOrders.industry,
                     starState.economy,
                     ordersService
                  );
                  if (industryOrder)
                  {
                     ordersCreated++;
                  }
               }

               // Process move standing orders
               if (standingOrders.move && standingOrders.move.destinationStarId)
               {
                  const moveOrder = await this.createMoveOrder(
                     gameId,
                     turnId,
                     starState.star_id,
                     playerId,
                     standingOrders.move.destinationStarId,
                     ordersService
                  );
                  if (moveOrder)
                  {
                     ordersCreated++;
                  }
               }

               console.log(`📋 StandingOrdersService: Processed standing orders for star ${starState.star_id}`);

            }
            catch (error)
            {
               console.error(`📋 StandingOrdersService: Error processing standing orders for star ${starState.star_id}:`, error);
               // Continue processing other stars even if one fails
            }
         }

         console.log(`📋 StandingOrdersService: Created ${ordersCreated} orders from ${starsProcessed} stars with standing orders`);

         return {
            success: true,
            ordersCreated,
            starsProcessed
         };

      }
      catch (error)
      {
         console.error('📋 StandingOrdersService: Error creating standing orders:', error);
         throw error;
      }
   }

   /**
    * Create an industry order from standing order percentages
    * @param {string} gameId - Game ID
    * @param {string} turnId - Turn ID
    * @param {string} starId - Star ID
    * @param {string} playerId - Player ID
    * @param {Object} industryPercentages - Industry percentages {expand, research, build}
    * @param {Object} economy - Current economy object
    * @param {OrdersService} ordersService - Orders service instance
    * @returns {Promise<Object|null>} Created order or null if error
    */
   async createIndustryOrder(gameId, turnId, starId, playerId, industryPercentages, economy, ordersService)
   {
      try
      {
         const available = economy?.available || 0;
         
         // Calculate actual values from percentages
         const expand = Math.floor((available * (industryPercentages.expand || 0)) / 100);
         const research = Math.floor((available * (industryPercentages.research || 0)) / 100);
         const build = Math.floor((available * (industryPercentages.build || 0)) / 100);

         // Validate that values don't exceed available
         const total = expand + research + build;
         if (total > available)
         {
            console.warn(`📋 StandingOrdersService: Total industry spending (${total}) exceeds available (${available}) for star ${starId}, capping values`);
            
            // Cap each value proportionally
            const scale = available / total;
            const cappedExpand = Math.floor(expand * scale);
            const cappedResearch = Math.floor(research * scale);
            const cappedBuild = Math.floor(build * scale);
            
            return await ordersService.createOrder({
               gameId,
               turnId,
               playerId,
               orderType: 'auto_build',
               payload: {
                  sourceStarId: starId,
                  expand: cappedExpand,
                  research: cappedResearch,
                  build: cappedBuild,
                  fromStandingOrder: true
               }
            });
         }

         // Create order if any value is greater than 0
         if (expand > 0 || research > 0 || build > 0)
         {
            return await ordersService.createOrder({
               gameId,
               turnId,
               playerId,
               orderType: 'auto_build',
               payload: {
                  sourceStarId: starId,
                  expand,
                  research,
                  build,
                  fromStandingOrder: true
               }
            });
         }

         return null;

      }
      catch (error)
      {
         console.error(`📋 StandingOrdersService: Error creating industry order for star ${starId}:`, error);
         return null;
      }
   }

   /**
    * Create a move order from standing order destination
    * @param {string} gameId - Game ID
    * @param {string} turnId - Turn ID
    * @param {string} sourceStarId - Source star ID
    * @param {string} playerId - Player ID
    * @param {string} destinationStarId - Destination star ID
    * @param {OrdersService} ordersService - Orders service instance
    * @returns {Promise<Object|null>} Created order or null if error
    */
   async createMoveOrder(gameId, turnId, sourceStarId, playerId, destinationStarId, ordersService)
   {
      try
      {
         // For move standing orders, we need to get all ships at the source star
         // We'll use a special payload that indicates "all ships"
         // The actual ship selection will be handled during order processing
         return await ordersService.createOrder({
            gameId,
            turnId,
            playerId,
            orderType: 'auto_move',
            payload: {
               sourceStarId,
               destinationStarId,
               selectedShipIds: [], // Empty array means "all ships" for standing orders
               fromStandingOrder: true
            }
         });

      }
      catch (error)
      {
         console.error(`📋 StandingOrdersService: Error creating move order from ${sourceStarId} to ${destinationStarId}:`, error);
         return null;
      }
   }
}
