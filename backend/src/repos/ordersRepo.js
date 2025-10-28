// backend/src/repos/ordersRepo.js
import { pool } from '../db/pool.js';
import { randomUUID } from 'crypto';

/**
 * Create or update an order for a player in a turn
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.turnId - Turn UUID
 * @param {string} params.playerId - Player UUID
 * @param {string} params.orderType - Type of order (move, industry, etc.)
 * @param {Object} params.payload - Order data as JSONB
 * @returns {Promise<Object>} The upserted order row
 */
export async function upsertOrder({ gameId, turnId, playerId, orderType, payload }) {
  const id = randomUUID();
  
  const { rows } = await pool.query(
    `INSERT INTO orders (id, game_id, turn_id, player_id, order_type, payload)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (game_id, turn_id, player_id)
     DO UPDATE SET 
       order_type = EXCLUDED.order_type,
       payload = EXCLUDED.payload,
       created_at = now()
     RETURNING *`,
    [id, gameId, turnId, playerId, orderType, payload]
  );
  
  return rows[0];
}

/**
 * Get an order for a specific player in a turn
 * @param {string} gameId - Game UUID
 * @param {string} turnId - Turn UUID
 * @param {string} playerId - Player UUID
 * @returns {Promise<Object|null>} The order row or null if not found
 */
export async function getOrder(gameId, turnId, playerId) {
  const { rows } = await pool.query(
    `SELECT * FROM orders 
     WHERE game_id=$1 AND turn_id=$2 AND player_id=$3`,
    [gameId, turnId, playerId]
  );
  
  return rows[0] || null;
}

/**
 * Get all orders for a specific turn
 * @param {string} gameId - Game UUID
 * @param {string} turnId - Turn UUID
 * @returns {Promise<Array>} Array of order rows
 */
export async function getOrdersForTurn(gameId, turnId) {
  const { rows } = await pool.query(
    `SELECT * FROM orders 
     WHERE game_id=$1 AND turn_id=$2
     ORDER BY created_at ASC`,
    [gameId, turnId]
  );
  
  return rows;
}

/**
 * Get orders for a specific star (by filtering payload)
 * @param {string} gameId - Game UUID
 * @param {string} turnId - Turn UUID
 * @param {string} starId - Star ID
 * @param {string} playerId - Player UUID (optional)
 * @param {string} orderType - Order type (optional)
 * @returns {Promise<Array>} Array of matching order rows
 */
export async function getOrdersForStar(gameId, turnId, starId, playerId = null, orderType = null) {
  let query = `
    SELECT * FROM orders 
    WHERE game_id=$1 AND turn_id=$2 AND payload->>'sourceStarId'=$3
  `;
  let params = [gameId, turnId, starId];
  
  if (playerId) {
    query += ` AND player_id=$${params.length + 1}`;
    params.push(playerId);
  }
  
  if (orderType) {
    query += ` AND order_type=$${params.length + 1}`;
    params.push(orderType);
  }
  
  query += ` ORDER BY created_at DESC`;
  
  const { rows } = await pool.query(query, params);
  return rows;
}

/**
 * Delete an order for a specific player in a turn
 * @param {string} gameId - Game UUID
 * @param {string} turnId - Turn UUID
 * @param {string} playerId - Player UUID
 * @returns {Promise<boolean>} True if an order was deleted
 */
export async function deleteOrder(gameId, turnId, playerId) {
  const { rowCount } = await pool.query(
    `DELETE FROM orders 
     WHERE game_id=$1 AND turn_id=$2 AND player_id=$3`,
    [gameId, turnId, playerId]
  );
  
  return rowCount > 0;
}

/**
 * Get orders by JSONB payload filter
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.turnId - Turn UUID
 * @param {Object} params.jsonFilter - JSONB filter object
 * @returns {Promise<Array>} Array of matching orders
 */
export async function findOrdersByPayload({ gameId, turnId, jsonFilter }) {
  const conditions = [];
  const params = [gameId, turnId];
  
  // Build dynamic WHERE conditions for JSONB filtering
  for (const [key, value] of Object.entries(jsonFilter)) {
    params.push(value);
    conditions.push(`payload->>'${key}' = $${params.length}`);
  }
  
  const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  
  const { rows } = await pool.query(
    `SELECT * FROM orders 
     WHERE game_id=$1 AND turn_id=$2 ${whereClause}
     ORDER BY created_at ASC`,
    params
  );
  
  return rows;
}

/**
 * Get orders by order type for a turn
 * @param {string} gameId - Game UUID
 * @param {string} turnId - Turn UUID
 * @param {string} orderType - Order type
 * @returns {Promise<Array>} Array of order rows
 */
export async function getOrdersByType(gameId, turnId, orderType) {
  const { rows } = await pool.query(
    `SELECT * FROM orders 
     WHERE game_id=$1 AND turn_id=$2 AND order_type=$3
     ORDER BY created_at ASC`,
    [gameId, turnId, orderType]
  );
  
  return rows;
}

/**
 * Count orders for a turn
 * @param {string} gameId - Game UUID
 * @param {string} turnId - Turn UUID
 * @returns {Promise<number>} Number of orders
 */
export async function countOrdersForTurn(gameId, turnId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as count FROM orders 
     WHERE game_id=$1 AND turn_id=$2`,
    [gameId, turnId]
  );
  
  return parseInt(rows[0].count);
}