/**
 * Utility functions for building ship summary table data.
 */

import { getShipDisplayName } from './shipGrouping.js';
import { RB } from './RequestBuilder.js';

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
 * Calculate ship health percentage
 * @param {Object} ship - Ship object
 * @returns {number} Health percentage (0-100)
 */
function getShipHealthPercentage(ship)
{
   const power = ship.power || ship.getPower?.() || 0;
   if (power === 0)
   {
      return 100; // Assume full health if no power
   }

   // Try to get hp directly, or calculate from damage
   if (ship.hp !== undefined)
   {
      return (ship.hp / power) * 100;
   }

   // Calculate from damage
   const damage = ship.damage || ship.getDamage?.() || 0;
   const hp = Math.max(0, power - damage);
   return (hp / power) * 100;
}

/**
 * Get ship power
 * @param {Object} ship - Ship object
 * @returns {number} Ship power
 */
function getShipPower(ship)
{
   return ship.power || ship.getPower?.() || 0;
}

/**
 * Check if an order is a standing order
 * @param {Object} order - Order object
 * @returns {boolean} True if standing order
 */
function isStandingOrder(order)
{
   return order.order_type === 'auto_move' || order.payload?.fromStandingOrder === true;
}

/**
 * Get standing move order for a star
 * @param {string} starId - Star ID
 * @returns {Object|null} Standing move order or null
 */
function getStandingMoveOrder(starId)
{
   const starState = window.globalStarStates?.get(String(starId));
   if (!starState || !starState.details)
   {
      return null;
   }

   const standingOrders = starState.details.standingOrders;
   if (!standingOrders || !standingOrders.move)
   {
      return null;
   }

   return standingOrders.move;
}

/**
 * Get ship summary rows for all stars
 * @param {string} gameId - Game ID
 * @param {string} turnId - Turn ID
 * @param {string} playerId - Player ID
 * @returns {Promise<Array>} Array of ship summary rows
 */
export async function getShipSummaryRows(gameId, turnId, playerId)
{
   console.log('🚢 getShipSummaryRows: Starting with params:', { gameId, turnId, playerId });
   
   if (!gameId || !turnId || !playerId)
   {
      console.warn('🚢 getShipSummaryRows: Missing required parameters', { gameId, turnId, playerId });
      return [];
   }

   try
   {
      // Get move orders for current turn
      console.log('🚢 getShipSummaryRows: Fetching orders from:', `/api/orders/turn/${turnId}?gameId=${gameId}&playerId=${playerId}`);
      const ordersResponse = await fetch(`/api/orders/turn/${turnId}?gameId=${gameId}&playerId=${playerId}`, {
        headers: RB.getHeadersForGet()
      });
      if (!ordersResponse.ok)
      {
         console.error('🚢 getShipSummaryRows: Failed to fetch orders', ordersResponse.statusText);
         return [];
      }

      const ordersResult = await ordersResponse.json();
      const orders = ordersResult.orders || [];
      console.log('🚢 getShipSummaryRows: Fetched orders:', orders.length, 'orders');

      // Build a map of move orders by source star
      const moveOrdersByStar = new Map();
      orders.forEach((order) =>
      {
         if (order.order_type !== 'move' && order.order_type !== 'auto_move')
         {
            return;
         }

         const payload = order.payload || {};
         const sourceStarId = payload.sourceStarId;
         if (!sourceStarId)
         {
            return;
         }

         if (!moveOrdersByStar.has(sourceStarId))
         {
            moveOrdersByStar.set(sourceStarId, []);
         }

         moveOrdersByStar.get(sourceStarId).push({
            order,
            destinationStarId: payload.destinationStarId,
            shipIds: payload.selectedShipIds || [],
            isStanding: isStandingOrder(order),
            isEmpty: (payload.selectedShipIds || []).length === 0
         });
      });

      // Build a set of all moving ship IDs by destination
      const movingShipsByDestination = new Map(); // destinationStarId -> Set of shipIds
      moveOrdersByStar.forEach((starOrders, sourceStarId) =>
      {
         starOrders.forEach((moveOrder) =>
         {
            const destId = moveOrder.destinationStarId;
            if (!destId)
            {
               return;
            }

            if (!movingShipsByDestination.has(destId))
            {
               movingShipsByDestination.set(destId, new Set());
            }

            // For standing orders with empty shipIds, we'll handle this later
            // For now, add the ship IDs that are specified
            moveOrder.shipIds.forEach((shipId) =>
            {
               movingShipsByDestination.get(destId).add(shipId);
            });
         });
      });

      // Get all stars from map model
      const mapModel = window.globalMapModel || window.mapGenerator?.mapModel;
      if (!mapModel || typeof mapModel.getStars !== 'function')
      {
         console.warn('🚢 getShipSummaryRows: Map model not available', {
            hasGlobalMapModel: !!window.globalMapModel,
            hasMapGenerator: !!window.mapGenerator,
            mapModelType: typeof mapModel
         });
         return [];
      }

      const stars = mapModel.getStars();
      console.log('🚢 getShipSummaryRows: Found', stars.length, 'stars in map model');
      const rows = [];

      stars.forEach((star) =>
      {
         if (!star)
         {
            return;
         }

         const starId = typeof star.getId === 'function' ? star.getId() : star.data?.star_id;
         if (!starId)
         {
            console.warn('🚢 getShipSummaryRows: Star missing ID', star);
            return;
         }

         // Get ships at this star
         const ships = typeof star.getShips === 'function' ? star.getShips() : star.ships || [];
         console.log(`🚢 getShipSummaryRows: Star ${starId} has ${ships.length} total ships`);
         
         // Filter ships to only include those owned by the current player
         const playerShips = ships.filter((ship) =>
         {
            const owner = ship.owner || ship.getOwner?.();
            if (!owner)
            {
               console.log(`🚢 getShipSummaryRows: Ship ${ship.id || ship.getId?.()} has no owner`);
               return false;
            }

            const ownerId = owner.id || owner.player_id || owner.user_id || owner.userId;
            const isPlayerShip = ownerId === playerId;
            if (!isPlayerShip)
            {
               console.log(`🚢 getShipSummaryRows: Ship ${ship.id || ship.getId?.()} owned by ${ownerId}, not ${playerId}`);
            }
            return isPlayerShip;
         });

         console.log(`🚢 getShipSummaryRows: Star ${starId} has ${playerShips.length} player ships (playerId: ${playerId})`);

         if (playerShips.length === 0)
         {
            // Skip stars with no player ships
            return;
         }

         // Get move orders for this star
         const starMoveOrders = moveOrdersByStar.get(starId) || [];
         console.log(`🚢 getShipSummaryRows: Star ${starId} has ${starMoveOrders.length} move orders`);

         // Check for standing move order
         const standingMoveOrder = getStandingMoveOrder(starId);
         const standingDestId = standingMoveOrder?.destinationStarId || null;
         if (standingMoveOrder)
         {
            console.log(`🚢 getShipSummaryRows: Star ${starId} has standing move order to ${standingDestId}`);
         }

         // Separate ships into free and moving
         const freeShips = [];
         const movingShipsByDest = new Map(); // destinationStarId -> Array of ships

         playerShips.forEach((ship) =>
         {
            const shipId = ship.id || ship.getId?.();
            console.log(`🚢 getShipSummaryRows: Processing ship ${shipId} at star ${starId}`);
            let isMoving = false;
            let movingToDestId = null;

            // Check regular move orders first (they take precedence)
            starMoveOrders.forEach((moveOrder) =>
            {
               const destId = moveOrder.destinationStarId;
               if (!destId)
               {
                  return;
               }

               // Check if this ship is in this move order
               if (moveOrder.shipIds.includes(shipId))
               {
                  console.log(`🚢 getShipSummaryRows: Ship ${shipId} is in move order to ${destId}`);
                  isMoving = true;
                  movingToDestId = destId;
               }
            });

            // If not in a regular order, check standing order
            if (!isMoving && standingDestId)
            {
               console.log(`🚢 getShipSummaryRows: Ship ${shipId} is in standing move order to ${standingDestId}`);
               isMoving = true;
               movingToDestId = standingDestId;
            }

            if (!isMoving || !movingToDestId)
            {
               console.log(`🚢 getShipSummaryRows: Ship ${shipId} is free (not moving)`);
               freeShips.push(ship);
            }
            else
            {
               console.log(`🚢 getShipSummaryRows: Ship ${shipId} is moving to ${movingToDestId}`);
               if (!movingShipsByDest.has(movingToDestId))
               {
                  movingShipsByDest.set(movingToDestId, []);
               }
               movingShipsByDest.get(movingToDestId).push(ship);
            }
         });

         console.log(`🚢 getShipSummaryRows: Star ${starId} - Free ships: ${freeShips.length}, Moving ships by dest:`, 
            Array.from(movingShipsByDest.entries()).map(([dest, ships]) => `${dest}:${ships.length}`).join(', '));

         // Sort free ships by power descending, then health percentage descending
         freeShips.sort((a, b) =>
         {
            const powerA = getShipPower(a);
            const powerB = getShipPower(b);
            if (powerA !== powerB)
            {
               return powerB - powerA; // Descending
            }

            const healthA = getShipHealthPercentage(a);
            const healthB = getShipHealthPercentage(b);
            return healthB - healthA; // Descending (most health first = least damaged first)
         });

         // Sort moving ships by destination
         movingShipsByDest.forEach((ships, destId) =>
         {
            ships.sort((a, b) =>
            {
               const powerA = getShipPower(a);
               const powerB = getShipPower(b);
               if (powerA !== powerB)
               {
                  return powerB - powerA; // Descending
               }

               const healthA = getShipHealthPercentage(a);
               const healthB = getShipHealthPercentage(b);
               return healthB - healthA; // Descending
            });
         });

         // Get adjacent stars
         const adjacentStarIds = typeof star.getConnectedStarIds === 'function' 
            ? star.getConnectedStarIds() 
            : (star.data?.connectedStarIds || []);

         // Build destination list with move counts
         const destinations = adjacentStarIds.map((adjStarId) =>
         {
            const moveCount = movingShipsByDest.get(adjStarId)?.length || 0;
            const moveOrder = starMoveOrders.find((mo) => mo.destinationStarId === adjStarId);
            // Check if this destination has a standing order
            const isStanding = (standingDestId === adjStarId) || (moveOrder?.isStanding || false);
            const orderId = moveOrder?.order?.id || null;

            return {
               starId: adjStarId,
               starName: getStarNameById(adjStarId),
               starNameColor: getStarOwnerColor(adjStarId),
               moveCount: moveCount,
               isStanding: isStanding,
               orderId: orderId,
               sourceStarId: starId, // Store source star ID for canceling standing orders
               movingShips: movingShipsByDest.get(adjStarId) || []
            };
         });

         // Check if there's a standing move order (already retrieved above)
         const hasStandingMove = Boolean(standingMoveOrder);

         // Get star name and color
         const starName = getStarNameById(starId);
         const starNameColor = getStarOwnerColor(starId);

         const row = {
            starId: starId,
            starName: starName,
            starNameColor: starNameColor,
            freeShips: freeShips,
            destinations: destinations,
            hasStandingMove: hasStandingMove,
            moveOrders: starMoveOrders,
            movingShipsByDest: movingShipsByDest
         };
         
         console.log(`🚢 getShipSummaryRows: Created row for star ${starId}:`, {
            starName: row.starName,
            freeShips: row.freeShips.length,
            destinations: row.destinations.length,
            hasStandingMove: row.hasStandingMove
         });
         
         rows.push(row);
      });

      console.log('🚢 getShipSummaryRows: Returning', rows.length, 'rows');
      return rows;
   }
   catch (error)
   {
      console.error('🚢 getShipSummaryRows: Error fetching ship summary', error);
      return [];
   }
}

