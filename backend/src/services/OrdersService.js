import { createDraft, findByPayload, listFinalOrdersForTurn } from '../repos/ordersRepo.js';
import { getOpenTurn } from '../repos/turnsRepo.js';

export class OrdersService
{
  /**
   * Create a new order submission
   * @param {Object} orderData - Order data
   * @param {string} orderData.gameId - Game ID
   * @param {string} orderData.turnId - Turn ID
   * @param {string} orderData.playerId - Player ID
   * @param {string} orderData.orderType - Type of order (e.g., 'build', 'move')
   * @param {Object} orderData.payload - Order payload data
   * @returns {Object} Created order
   */
  async createOrder(orderData)
  {
    const { gameId, turnId, playerId, orderType, payload } = orderData;
    
    return await createDraft({
      gameId,
      turnId,
      playerId,
      orderType,
      payload
    });
  }

  /**
   * Get orders for a specific star in a game
   * @param {string} gameId - Game ID
   * @param {string} starId - Star ID
   * @param {string} playerId - Player ID (optional, to filter by player)
   * @returns {Array} Array of orders
   */
  async getOrdersForStar(gameId, starId, playerId = null)
  {
    // Get the current turn for the game
    const turn = await this.getCurrentTurn(gameId);
    if (!turn) {
      return [];
    }

    // Use findByPayload to find orders for this star
    const orders = await findByPayload({
      gameId,
      turnId: turn.id,
      jsonFilter: { starId }
    });

    // Filter by player if specified
    if (playerId) {
      return orders.filter(order => order.player_id === playerId);
    }

    return orders;
  }

  /**
   * Get all orders for a game and turn
   * @param {string} gameId - Game ID
   * @param {string} turnId - Turn ID
   * @param {string} playerId - Player ID (optional, to filter by player)
   * @returns {Array} Array of orders
   */
  async getOrdersForTurn(gameId, turnId, playerId = null)
  {
    const orders = await listFinalOrdersForTurn(gameId, turnId);
    
    // Filter by player if specified
    if (playerId) {
      return orders.filter(order => order.player_id === playerId);
    }
    
    return orders;
  }

  /**
   * Get the current open turn for a game
   * @param {string} gameId - Game ID
   * @returns {Object|null} Current turn or null
   */
  async getCurrentTurn(gameId)
  {
    return await getOpenTurn(gameId);
  }

  /**
   * Get the latest order for a specific star and player
   * @param {string} gameId - Game ID
   * @param {string} starId - Star ID
   * @param {string} playerId - Player ID
   * @returns {Object|null} Latest order or null
   */
  async getLatestOrderForStar(gameId, starId, playerId)
  {
    const orders = await this.getOrdersForStar(gameId, starId, playerId);
    return orders.length > 0 ? orders[0] : null;
  }
}
