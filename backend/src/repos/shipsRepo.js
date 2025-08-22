// backend/src/repos/shipsRepo.js
import { pool } from '../db/pool.js';
import { randomUUID } from 'crypto';

/**
 * Add a new ship
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.ownerPlayer - Owner player UUID
 * @param {string} params.locationStarId - Current star location
 * @param {number} params.hp - Ship hit points
 * @param {number} params.power - Ship power
 * @param {Object} params.details - Additional ship details (default: {})
 * @returns {Promise<Object>} The created ship row
 */
export async function addShip({ gameId, ownerPlayer, locationStarId, hp, power, details = {} }) {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO ship (id, game_id, owner_player, location_star_id, hp, power, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [id, gameId, ownerPlayer, locationStarId, hp, power, details]
  );
  
  return rows[0];
}

/**
 * List all ships at a specific star
 * @param {string} gameId - Game UUID
 * @param {string} starId - Star ID
 * @returns {Promise<Array>} Array of ship rows
 */
export async function listShipsAt(gameId, starId) {
  const { rows } = await pool.query(
    `SELECT * FROM ship WHERE game_id=$1 AND location_star_id=$2`,
    [gameId, starId]
  );
  
  return rows;
}

/**
 * List all ships owned by a player
 * @param {string} gameId - Game UUID
 * @param {string} playerId - Player UUID
 * @returns {Promise<Array>} Array of ship rows
 */
export async function listPlayerShips(gameId, playerId) {
  const { rows } = await pool.query(
    `SELECT * FROM ship WHERE game_id=$1 AND owner_player=$2`,
    [gameId, playerId]
  );
  
  return rows;
}

/**
 * Move a ship to a new star location
 * @param {string} gameId - Game UUID
 * @param {string} shipId - Ship UUID
 * @param {string} newStarId - New star location
 * @returns {Promise<Object|null>} The updated ship row or null
 */
export async function moveShip(gameId, shipId, newStarId) {
  const { rows } = await pool.query(
    `UPDATE ship SET location_star_id=$3 
     WHERE game_id=$1 AND id=$2 RETURNING *`,
    [gameId, shipId, newStarId]
  );
  
  return rows[0] ?? null;
}
