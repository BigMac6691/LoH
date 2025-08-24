// backend/src/repos/eventsRepo.js
import { pool } from '../db/pool.js';
import { randomUUID } from 'crypto';

/**
 * Get the next sequence number for events in a turn
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.turnId - Turn UUID
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<number>} The next sequence number
 */
export async function getNextSequenceNumber({ gameId, turnId }, client = null) {
  const dbClient = client || pool;
  
  if (client) {
    // Use provided client (assumes transaction is already started)
    const { rows } = await dbClient.query(
      `SELECT COALESCE((SELECT MAX(seq) FROM turn_resolution_event WHERE game_id=$1 AND turn_id=$2), 0) + 1 as next_seq`,
      [gameId, turnId]
    );
    
    return rows[0].next_seq;
  } else {
    // Use transaction for standalone operation
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { rows } = await dbClient.query(
        `SELECT COALESCE((SELECT MAX(seq) FROM turn_resolution_event WHERE game_id=$1 AND turn_id=$2), 0) + 1 as next_seq`,
        [gameId, turnId]
      );
      
      await client.query('COMMIT');
      return rows[0].next_seq;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

/**
 * Log an event for turn resolution
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.turnId - Turn UUID
 * @param {string} params.kind - Event kind (move, combat, production, etc.)
 * @param {Object} params.details - Event details as JSONB
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object>} The created event row
 */
export async function logEvent({ gameId, turnId, kind, details }, client = null) {
  const dbClient = client || pool;
  
  if (client) {
    // Use provided client (assumes transaction is already started)
    // Get next sequence number
    const seq = await getNextSequenceNumber({ gameId, turnId }, client);
    
    // Insert event
    const id = randomUUID();
    const { rows } = await dbClient.query(
      `INSERT INTO turn_resolution_event (id, game_id, turn_id, seq, kind, details)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, gameId, turnId, seq, kind, details]
    );
    
    return rows[0];
  } else {
    // Use transaction for standalone operation
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get next sequence number
      const seq = await getNextSequenceNumber({ gameId, turnId }, client);
      
      // Insert event
      const id = randomUUID();
      const { rows } = await client.query(
        `INSERT INTO turn_resolution_event (id, game_id, turn_id, seq, kind, details)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, gameId, turnId, seq, kind, details]
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
 * Find events by JSONB filter
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.turnId - Turn UUID
 * @param {Object} params.jsonFilter - JSONB filter object
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Array>} Array of matching event rows
 */
export async function findEvents({ gameId, turnId, jsonFilter }, client = null) {
  const dbClient = client || pool;
  
  const { rows } = await dbClient.query(
    `SELECT * FROM turn_resolution_event 
     WHERE game_id=$1 AND turn_id=$2 AND details @> $3::jsonb
     ORDER BY seq`,
    [gameId, turnId, JSON.stringify(jsonFilter)]
  );
  
  return rows;
}
