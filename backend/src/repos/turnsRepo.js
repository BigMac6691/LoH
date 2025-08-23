// backend/src/repos/turnsRepo.js
import { pool } from '../db/pool.js';
import { randomUUID } from 'crypto';

/**
 * Open a new turn for a game
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {number} params.number - Turn number
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object>} The turn row (existing or newly created)
 */
export async function openTurn({ gameId, number }, client = null) {
  const dbClient = client || pool;
  
  if (client) {
    // Use provided client (assumes transaction is already started)
    const { rows: existing } = await dbClient.query(
      `SELECT * FROM game_turn WHERE game_id=$1 AND number=$2`,
      [gameId, number]
    );
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    // Create new turn
    const { rows } = await dbClient.query(
      `INSERT INTO game_turn (id, game_id, number, status) 
       VALUES ($1, $2, $3, 'open') RETURNING *`,
      [randomUUID(), gameId, number]
    );
    
    return rows[0];
  } else {
    // Use transaction for standalone operation
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if turn already exists
      const { rows: existing } = await client.query(
        `SELECT * FROM game_turn WHERE game_id=$1 AND number=$2`,
        [gameId, number]
      );
      
      if (existing.length > 0) {
        await client.query('COMMIT');
        return existing[0];
      }
      
      // Create new turn
      const { rows } = await client.query(
        `INSERT INTO game_turn (id, game_id, number, status) 
         VALUES ($1, $2, $3, 'open') RETURNING *`,
        [randomUUID(), gameId, number]
      );
      
      await client.query('COMMIT');
      return rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

/**
 * Get the currently open turn for a game
 * @param {string} gameId - Game UUID
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object|null>} The open turn row or null
 */
export async function getOpenTurn(gameId, client = null) {
  const dbClient = client || pool;
  
  const { rows } = await dbClient.query(
    `SELECT * FROM game_turn WHERE game_id=$1 AND status='open' LIMIT 1`,
    [gameId]
  );
  
  return rows[0] ?? null;
}

/**
 * Close a turn
 * @param {string} gameId - Game UUID
 * @param {number} number - Turn number
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object|null>} The closed turn row or null
 */
export async function closeTurn(gameId, number, client = null) {
  const dbClient = client || pool;
  
  const { rows } = await dbClient.query(
    `UPDATE game_turn SET status='closed', closed_at=now() 
     WHERE game_id=$1 AND number=$2 AND status='open' RETURNING *`,
    [gameId, number]
  );
  
  return rows[0] ?? null;
}

/**
 * Mark a turn as resolving
 * @param {string} gameId - Game UUID
 * @param {number} number - Turn number
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object|null>} The resolving turn row or null
 */
export async function markTurnResolving(gameId, number, client = null) {
  const dbClient = client || pool;
  
  const { rows } = await dbClient.query(
    `UPDATE game_turn SET status='resolving' 
     WHERE game_id=$1 AND number=$2 AND status='open' RETURNING *`,
    [gameId, number]
  );
  
  return rows[0] ?? null;
}
