import { MoveOrder } from './MoveOrder.js';

/**
 * MoveOrderStore - In-memory store for move orders
 * Persists move orders keyed by `${playerId}:${originStarId}`
 */
export class MoveOrderStore {
  constructor() {
    /** @type {Map<string, MoveOrder>} */
    this.orders = new Map();
  }

  /**
   * Generate a key for storing move orders
   * @param {string} playerId - Player ID
   * @param {string} originStarId - Origin star ID
   * @returns {string} Storage key
   */
  generateKey(playerId, originStarId) {
    return `${playerId}:${originStarId}`;
  }

  /**
   * Store a move order
   * @param {string} playerId - Player ID
   * @param {string} originStarId - Origin star ID
   * @param {MoveOrder} moveOrder - Move order to store
   */
  storeOrder(playerId, originStarId, moveOrder) {
    console.log('📋 MoveOrderStore: storeOrder called with:', { playerId, originStarId, moveOrder });
    
    if (playerId === null || playerId === undefined || 
        originStarId === null || originStarId === undefined || 
        moveOrder === null || moveOrder === undefined) {
      console.warn('MoveOrderStore: Invalid parameters for storeOrder', { playerId, originStarId, moveOrder });
      return;
    }

    const key = this.generateKey(playerId, originStarId);
    console.log('📋 MoveOrderStore: Storing order with key:', key);
    this.orders.set(key, moveOrder.clone()); // Store a copy
    console.log('📋 MoveOrderStore: Order stored. Total orders now:', this.orders.size);
  }

  /**
   * Retrieve a move order
   * @param {string} playerId - Player ID
   * @param {string} originStarId - Origin star ID
   * @returns {MoveOrder|null} Move order or null if not found
   */
  getOrder(playerId, originStarId) {
    if (playerId === null || playerId === undefined || 
        originStarId === null || originStarId === undefined) {
      return null;
    }

    const key = this.generateKey(playerId, originStarId);
    const order = this.orders.get(key);
    return order ? order.clone() : null; // Return a copy
  }

  /**
   * Check if a move order exists
   * @param {string} playerId - Player ID
   * @param {string} originStarId - Origin star ID
   * @returns {boolean} True if order exists
   */
  hasOrder(playerId, originStarId) {
    if (playerId === null || playerId === undefined || 
        originStarId === null || originStarId === undefined) {
      return false;
    }

    const key = this.generateKey(playerId, originStarId);
    return this.orders.has(key);
  }

  /**
   * Remove a move order
   * @param {string} playerId - Player ID
   * @param {string} originStarId - Origin star ID
   * @returns {boolean} True if order was removed
   */
  removeOrder(playerId, originStarId) {
    if (playerId === null || playerId === undefined || 
        originStarId === null || originStarId === undefined) {
      return false;
    }

    const key = this.generateKey(playerId, originStarId);
    return this.orders.delete(key);
  }

  /**
   * Get all move orders for a player
   * @param {string} playerId - Player ID
   * @returns {Array<MoveOrder>} Array of move orders
   */
  getOrdersForPlayer(playerId) {
    if (playerId === null || playerId === undefined) {
      return [];
    }

    const playerOrders = [];
    for (const [key, order] of this.orders) {
      if (key.startsWith(`${playerId}:`)) {
        playerOrders.push(order.clone());
      }
    }
    return playerOrders;
  }

  /**
   * Get all move orders
   * @returns {Array<MoveOrder>} Array of all move orders
   */
  getAllOrders() {
    return Array.from(this.orders.values()).map(order => order.clone());
  }

  /**
   * Clear all move orders
   */
  clearAll() {
    this.orders.clear();
  }

  /**
   * Clear all move orders for a specific player
   * @param {string} playerId - Player ID
   */
  clearPlayerOrders(playerId) {
    if (playerId === null || playerId === undefined) {
      return;
    }

    const keysToDelete = [];
    for (const key of this.orders.keys()) {
      if (key.startsWith(`${playerId}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.orders.delete(key));
  }

  /**
   * Get the number of stored orders
   * @returns {number} Number of orders
   */
  getOrderCount() {
    return this.orders.size;
  }

  /**
   * Get debug information about stored orders
   * @returns {Object} Debug info
   */
  getDebugInfo() {
    const info = {
      totalOrders: this.orders.size,
      orders: []
    };

    for (const [key, order] of this.orders) {
      info.orders.push({
        key,
        summary: order.getSummary()
      });
    }

    return info;
  }
}

// Export singleton instance
export const moveOrderStore = new MoveOrderStore();
