// backend/src/repos/turnEventRepo.js
import { pool } from '../db/pool.js';

/**
 * Get turn events for a specific player in a turn
 * @param {string} gameId - Game UUID
 * @param {string} turnId - Turn UUID
 * @param {string} playerId - Player UUID (null for global events)
 * @param {string} kind - Event type filter (optional)
 * @returns {Promise<Array>} Array of turn events
 */
export async function getTurnEventsForPlayer(gameId, turnId, playerId, kind = null) {
  let query = `
    SELECT * FROM turn_event 
    WHERE game_id = $1 AND turn_id = $2 AND (player_id = $3 OR player_id IS NULL)
  `;
  let params = [gameId, turnId, playerId];
  
  if (kind) {
    query += ` AND kind = $${params.length + 1}`;
    params.push(kind);
  }
  
  query += ` ORDER BY seq ASC, created_at ASC`;
  
  const { rows } = await pool.query(query, params);
  return rows;
}

/**
 * Get all turn events for a turn (all players)
 * @param {string} gameId - Game UUID
 * @param {string} turnId - Turn UUID
 * @param {string} kind - Event type filter (optional)
 * @returns {Promise<Array>} Array of turn events
 */
export async function getAllTurnEvents(gameId, turnId, kind = null) {
  let query = `
    SELECT * FROM turn_event 
    WHERE game_id = $1 AND turn_id = $2
  `;
  let params = [gameId, turnId];
  
  if (kind) {
    query += ` AND kind = $${params.length + 1}`;
    params.push(kind);
  }
  
  query += ` ORDER BY seq ASC, created_at ASC`;
  
  const { rows } = await pool.query(query, params);
  return rows;
}

/**
 * Get turn events by kind across multiple turns
 * @param {string} gameId - Game UUID
 * @param {string} playerId - Player UUID (null for global events)
 * @param {string} kind - Event type
 * @param {number} limit - Maximum number of events to return
 * @returns {Promise<Array>} Array of turn events
 */
export async function getTurnEventsByKind(gameId, playerId, kind, limit = 100) {
  let query = `
    SELECT te.*, gt.number as turn_number
    FROM turn_event te
    JOIN game_turn gt ON te.turn_id = gt.id
    WHERE te.game_id = $1 AND te.kind = $2
  `;
  let params = [gameId, kind];
  
  if (playerId) {
    query += ` AND (te.player_id = $${params.length + 1} OR te.player_id IS NULL)`;
    params.push(playerId);
  }
  
  query += ` ORDER BY gt.number DESC, te.seq ASC LIMIT $${params.length + 1}`;
  params.push(limit);
  
  const { rows } = await pool.query(query, params);
  return rows;
}
