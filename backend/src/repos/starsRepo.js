// backend/src/repos/starsRepo.js
import { pool } from '../db/pool.js';
import { randomUUID } from 'crypto';

/**
 * Upsert star state (insert or update)
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.starId - Star ID
 * @param {string|null} params.ownerPlayer - Owner player UUID (optional)
 * @param {Object} params.economy - Economy data (default: {})
 * @param {Object} params.damage - Damage data (default: {})
 * @returns {Promise<Object>} The upserted star state row
 */
export async function upsertStarState({ gameId, starId, ownerPlayer = null, economy = {}, damage = {} }) {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO star_state (id, game_id, star_id, owner_player, economy, damage)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (game_id, star_id)
     DO UPDATE SET owner_player=EXCLUDED.owner_player,
                   economy=EXCLUDED.economy,
                   damage=EXCLUDED.damage,
                   updated_at=now()
     RETURNING *`,
    [id, gameId, starId, ownerPlayer, economy, damage]
  );
  
  return rows[0];
}

/**
 * Get star state by game and star ID
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.starId - Star ID
 * @returns {Promise<Object|null>} The star state row or null
 */
export async function getStarState({ gameId, starId }) {
  const { rows } = await pool.query(
    `SELECT * FROM star_state WHERE game_id=$1 AND star_id=$2`,
    [gameId, starId]
  );
  
  return rows[0] ?? null;
}

/**
 * List all stars owned by a player
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.playerId - Player UUID
 * @returns {Promise<Array>} Array of star state rows
 */
export async function listStarsByOwner({ gameId, playerId }) {
  const { rows } = await pool.query(
    `SELECT * FROM star_state WHERE game_id=$1 AND owner_player=$2`,
    [gameId, playerId]
  );
  
  return rows;
}
