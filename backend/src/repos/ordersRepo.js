// backend/src/repos/ordersRepo.js
import { pool } from '../db/pool.js';
import { randomUUID } from 'crypto';

/**
 * Create a new draft order
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.turnId - Turn UUID
 * @param {string} params.playerId - Player UUID
 * @param {string} params.orderType - Type of order (move, industry, etc.)
 * @param {Object} params.payload - Order data as JSONB
 * @returns {Promise<Object>} The inserted order row
 */
export async function createDraft({ gameId, turnId, playerId, orderType, payload }) {
  const id = randomUUID();
  const clientOrderId = randomUUID();
  
  const { rows } = await pool.query(
    `INSERT INTO order_submission (
      id, game_id, turn_id, player_id, client_order_id, revision, 
      order_type, payload, is_deleted, is_final
    ) VALUES ($1, $2, $3, $4, $5, 1, $6, $7, false, false) 
    RETURNING *`,
    [id, gameId, turnId, playerId, clientOrderId, orderType, payload]
  );
  
  return rows[0];
}

/**
 * Edit an existing draft order by creating a new revision
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.turnId - Turn UUID
 * @param {string} params.playerId - Player UUID
 * @param {string} params.clientOrderId - Client order UUID
 * @param {string} params.orderType - Type of order
 * @param {Object} params.payload - Order data as JSONB
 * @returns {Promise<Object>} The new revision row
 * @throws {Error} If no existing draft found
 */
export async function editDraft({ gameId, turnId, playerId, clientOrderId, orderType, payload }) {
  // Find latest revision
  const { rows: latest } = await pool.query(
    `SELECT revision FROM order_submission
     WHERE game_id=$1 AND turn_id=$2 AND player_id=$3 AND client_order_id=$4
     ORDER BY revision DESC LIMIT 1`,
    [gameId, turnId, playerId, clientOrderId]
  );
  
  if (latest.length === 0) {
    throw new Error('No existing draft found for this client order ID');
  }
  
  const newRevision = latest[0].revision + 1;
  const id = randomUUID();
  
  const { rows } = await pool.query(
    `INSERT INTO order_submission (
      id, game_id, turn_id, player_id, client_order_id, revision,
      order_type, payload, is_deleted, is_final
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, false)
    RETURNING *`,
    [id, gameId, turnId, playerId, clientOrderId, newRevision, orderType, payload]
  );
  
  return rows[0];
}

/**
 * Delete a draft order by creating a deleted revision
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.turnId - Turn UUID
 * @param {string} params.playerId - Player UUID
 * @param {string} params.clientOrderId - Client order UUID
 * @returns {Promise<Object>} The deleted revision row
 * @throws {Error} If no existing draft found
 */
export async function deleteDraft({ gameId, turnId, playerId, clientOrderId }) {
  // Find latest revision to copy order_type/payload
  const { rows: latest } = await pool.query(
    `SELECT revision, order_type, payload FROM order_submission
     WHERE game_id=$1 AND turn_id=$2 AND player_id=$3 AND client_order_id=$4
     ORDER BY revision DESC LIMIT 1`,
    [gameId, turnId, playerId, clientOrderId]
  );
  
  if (latest.length === 0) {
    throw new Error('No existing draft found for this client order ID');
  }
  
  const newRevision = latest[0].revision + 1;
  const id = randomUUID();
  
  const { rows } = await pool.query(
    `INSERT INTO order_submission (
      id, game_id, turn_id, player_id, client_order_id, revision,
      order_type, payload, is_deleted, is_final
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, false)
    RETURNING *`,
    [id, gameId, turnId, playerId, clientOrderId, newRevision, latest[0].order_type, latest[0].payload]
  );
  
  return rows[0];
}

/**
 * List the latest non-deleted drafts for a player in a turn
 * @param {string} gameId - Game UUID
 * @param {string} turnId - Turn UUID
 * @param {string} playerId - Player UUID
 * @returns {Promise<Array>} Array of latest draft orders
 */
export async function listLatestDrafts(gameId, turnId, playerId) {
  const { rows } = await pool.query(
    `WITH ranked AS (
       SELECT os.*,
              ROW_NUMBER() OVER (
                PARTITION BY client_order_id
                ORDER BY revision DESC, created_at DESC
              ) AS rn
       FROM order_submission os
       WHERE game_id=$1 AND turn_id=$2 AND player_id=$3 AND is_final=false
     )
     SELECT * FROM ranked WHERE rn=1 AND is_deleted=false ORDER BY created_at`,
    [gameId, turnId, playerId]
  );
  
  return rows;
}

/**
 * Finalize all drafts for a player in a turn
 * @param {string} gameId - Game UUID
 * @param {string} turnId - Turn UUID
 * @param {string} playerId - Player UUID
 * @returns {Promise<Array>} Array of finalized order rows
 */
export async function finalizePlayerTurn(gameId, turnId, playerId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get latest non-deleted drafts
    const { rows: drafts } = await client.query(
      `WITH ranked AS (
         SELECT os.*,
                ROW_NUMBER() OVER (
                  PARTITION BY client_order_id
                  ORDER BY revision DESC, created_at DESC
                ) AS rn
         FROM order_submission os
         WHERE game_id=$1 AND turn_id=$2 AND player_id=$3 AND is_final=false
       )
       SELECT * FROM ranked WHERE rn=1 AND is_deleted=false`,
      [gameId, turnId, playerId]
    );
    
    // Clear existing final orders
    await client.query(
      `UPDATE order_submission SET is_final=false 
       WHERE game_id=$1 AND turn_id=$2 AND player_id=$3 AND is_final=true`,
      [gameId, turnId, playerId]
    );
    
    // Create final copies
    const finalOrders = [];
    for (const draft of drafts) {
      const id = randomUUID();
      const newRevision = draft.revision + 1;
      
      const { rows } = await client.query(
        `INSERT INTO order_submission (
          id, game_id, turn_id, player_id, client_order_id, revision,
          order_type, payload, is_deleted, is_final, finalized_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, true, now())
        RETURNING *`,
        [id, gameId, turnId, playerId, draft.client_order_id, newRevision, draft.order_type, draft.payload]
      );
      
      finalOrders.push(rows[0]);
    }
    
    await client.query('COMMIT');
    return finalOrders;
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Find orders by JSONB payload filter
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.turnId - Turn UUID
 * @param {Object} params.jsonFilter - JSONB filter object
 * @returns {Promise<Array>} Array of matching orders
 */
export async function findByPayload({ gameId, turnId, jsonFilter }) {

  console.log('🔍 findByPayload: gameId:', gameId);
  console.log('🔍 findByPayload: turnId:', turnId);
  console.log('🔍 findByPayload: jsonFilter:', jsonFilter);

  const { rows } = await pool.query(
    `SELECT * FROM order_submission 
     WHERE game_id=$1 AND turn_id=$2 AND payload @> $3::jsonb
     ORDER BY created_at`,
    [gameId, turnId, JSON.stringify(jsonFilter)]
  );
  
  return rows;
}

/**
 * List all final orders for a turn (legacy function - keep for compatibility)
 * @param {string} gameId - Game UUID
 * @param {string} turnId - Turn UUID
 * @returns {Promise<Array>} Array of final orders
 */
export async function listFinalOrdersForTurn(gameId, turnId) {
  const { rows } = await pool.query(
    `SELECT * FROM order_submission
     WHERE game_id=$1 AND turn_id=$2 AND is_final=true
     ORDER BY created_at`,
    [gameId, turnId]
  );
  
  return rows;
}
