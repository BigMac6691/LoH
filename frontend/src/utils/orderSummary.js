/**
 * Utility functions for building order summary table data.
 */
import { RB, ApiError } from './RequestBuilder.js';

/**
 * Get star name from star ID
 * @param {string} starId - Star ID
 * @returns {string} Star name
 */
function getStarNameById(starId)
{
   const mapModel = window.globalMapModel || window.mapGenerator?.mapModel;
   if (!mapModel || typeof mapModel.getStarById !== 'function')
   {
      return `Star ${starId}`;
   }

   const star = mapModel.getStarById(starId);
   if (!star)
   {
      return `Star ${starId}`;
   }

   if (typeof star.getName === 'function')
   {
      const name = star.getName();
      if (name)
      {
         return name;
      }
   }

   return `Star ${starId}`;
}

/**
 * Get owner color for a star
 * @param {string} starId - Star ID
 * @returns {string} Owner color hex code, or '#FFFFFF' for neutral/unowned
 */
function getStarOwnerColor(starId)
{
   const mapModel = window.globalMapModel || window.mapGenerator?.mapModel;
   if (!mapModel || typeof mapModel.getStarById !== 'function')
   {
      return '#FFFFFF';
   }

   const star = mapModel.getStarById(starId);
   if (!star)
   {
      return '#FFFFFF';
   }

   const owner = typeof star.getOwner === 'function' ? star.getOwner() : star.owner;
   if (!owner)
   {
      return '#FFFFFF';
   }

   // Try various property names for owner color
   const ownerColor = owner.color_hex
      || owner.colorHex
      || owner.color
      || owner.colour
      || (typeof star.getColor === 'function' ? star.getColor() : null)
      || '#FFFFFF';

   return ownerColor;
}

/**
 * Get destination star name from order payload
 * @param {Object} order - Order object
 * @returns {string|null} Destination star name or null
 */
function getDestinationStarName(order)
{
   const payload = order.payload || {};
   const destinationStarId = payload.destinationStarId;
   
   if (!destinationStarId)
   {
      return null;
   }

   return getStarNameById(destinationStarId);
}

/**
 * Get ship names from ship IDs
 * @param {Array<string>} shipIds - Array of ship IDs
 * @returns {Array<string>} Array of ship names
 */
function getShipNames(shipIds)
{
   if (!Array.isArray(shipIds) || shipIds.length === 0)
   {
      return [];
   }

   // For now, just return ship IDs as names
   // In the future, we might want to look up actual ship names
   return shipIds.map(id => `Ship ${id}`);
}

/**
 * Get order type display label
 * @param {string} orderType - Order type
 * @returns {string} Display label
 */
function getOrderTypeLabel(orderType)
{
   if (!orderType)
   {
      return '---';
   }

   const labels = {
      'build': 'Build',
      'move': 'Move',
      'auto_build': 'Auto Build',
      'auto_move': 'Auto Move'
   };

   return labels[orderType] || orderType;
}

/**
 * Check if order is from standing order
 * @param {Object} order - Order object
 * @returns {boolean} True if from standing order
 */
function isStandingOrder(order)
{
   const payload = order.payload || {};
   return Boolean(payload.fromStandingOrder);
}

/**
 * Get standing order percentages for a star
 * @param {string} starId - Star ID
 * @returns {Object|null} Standing order percentages or null
 */
function getStandingOrderPercentages(starId)
{
   const starState = window.globalStarStates?.get(String(starId));
   if (!starState || !starState.details)
   {
      return null;
   }

   const standingOrders = starState.details.standingOrders;
   if (!standingOrders || !standingOrders.industry)
   {
      return null;
   }

   return standingOrders.industry;
}

/**
 * Build table row data for all orders for the current turn.
 * @param {string} gameId - Game ID
 * @param {string} turnId - Turn ID
 * @param {string} playerId - Player ID
 * @returns {Promise<Array<Object>>} Array of order summary rows
 */
export async function getOrderSummaryRows(gameId, turnId, playerId)
{
   if (!gameId || !turnId || !playerId)
   {
      console.warn('📋 getOrderSummaryRows: Missing required parameters');
      return [];
   }

   try
   {
      // Fetch orders for the current turn
      const result = await RB.fetchGet(`/api/orders/turn/${turnId}?gameId=${gameId}&playerId=${playerId}`);
      const orders = result.orders || [];

      if (orders.length === 0)
      {
         return [];
      }

      // Group orders by star
      const ordersByStar = new Map();
      
      orders.forEach((order) =>
      {
         const payload = order.payload || {};
         const sourceStarId = payload.sourceStarId;
         
         if (!sourceStarId)
         {
            return;
         }

         if (!ordersByStar.has(sourceStarId))
         {
            ordersByStar.set(sourceStarId, []);
         }

         ordersByStar.get(sourceStarId).push(order);
      });

      // Build rows - one row per order, grouped by star
      const rows = [];
      const starNameRows = new Map(); // Track how many rows each star has

      ordersByStar.forEach((starOrders, starId) =>
      {
         const starName = getStarNameById(starId);
         const standingOrderPercentages = getStandingOrderPercentages(starId);
         
         starOrders.forEach((order, index) =>
         {
            const orderType = order.order_type || '---';
            const payload = order.payload || {};
            const isStanding = isStandingOrder(order);
            
            let industry = null;
            let research = null;
            let build = null;
            let move = null;
            let destination = null;

            if (orderType === 'build' || orderType === 'auto_build')
            {
               if (isStanding && standingOrderPercentages)
               {
                  // Show percentages for standing orders
                  industry = standingOrderPercentages.expand || 0;
                  research = standingOrderPercentages.research || 0;
                  build = standingOrderPercentages.build || 0;
               }
               else
               {
                  // Show actual values
                  industry = payload.expand || 0;
                  research = payload.research || 0;
                  build = payload.build || 0;
               }
            }
            else if (orderType === 'move' || orderType === 'auto_move')
            {
               destination = getDestinationStarName(order);
               const shipIds = payload.selectedShipIds || [];
               move = {
                  shipIds: shipIds,
                  isAuto: orderType === 'auto_move',
                  isEmpty: shipIds.length === 0
               };
            }

            // Get owner colors for source and destination stars
            const sourceStarColor = getStarOwnerColor(starId);
            const destinationStarColor = destination && payload.destinationStarId 
               ? getStarOwnerColor(payload.destinationStarId) 
               : '#FFFFFF';

            rows.push({
               starId: starId,
               starName: starName,
               starNameColor: sourceStarColor,
               orderType: orderType,
               industry: industry,
               research: research,
               build: build,
               move: move,
               destination: destination,
               destinationColor: destinationStarColor,
               order: order,
               isFirstRow: index === 0,
               rowSpan: starOrders.length
            });

            if (index === 0)
            {
               starNameRows.set(starId, starOrders.length);
            }
         });
      });

      // Don't sort here - let the dialog handle sorting
      // This allows the dialog to maintain grouping by star when sorting
      return rows;

   }
   catch (error)
   {
      console.error('📋 getOrderSummaryRows: Error fetching orders', error);
      return [];
   }
}
