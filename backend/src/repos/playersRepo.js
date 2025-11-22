// backend/src/repos/playersRepo.js
import { pool } from '../db/pool.js';
import { randomUUID } from 'crypto';

/**
 * Add a player to a game
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.userId - User UUID
 * @param {string} params.name - Player name
 * @param {string} params.colorHex - Player color hex
 * @param {string} params.countryName - Country name (optional)
 * @param {Object} params.meta - Meta data (optional, defaults to empty object)
 * @param {string} params.type - Player type: 'player' (human) or 'ai' (default: 'player')
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object>} The created player row
 */
export async function addPlayer({ gameId, userId, name, colorHex, countryName = null, meta = {}, type = 'player' }, client = null) {
  const id = randomUUID();
  const dbClient = client || pool;
  
  // Ensure meta is an object
  const metaData = typeof meta === 'string' ? JSON.parse(meta) : meta;
  
  // Validate type
  if (type !== 'player' && type !== 'ai') {
    throw new Error(`Invalid player type: ${type}. Must be 'player' or 'ai'`);
  }
  
  const { rows } = await dbClient.query(
    `INSERT INTO game_player (id, game_id, user_id, name, color_hex, country_name, meta, type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [id, gameId, userId, name, colorHex, countryName, JSON.stringify(metaData), type]
  );
  
  return rows[0];
}

/**
 * List all players in a game
 * @param {string} gameId - Game UUID
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Array>} Array of player rows
 */
export async function listPlayers(gameId, client = null) {
  const dbClient = client || pool;
  
  const { rows } = await dbClient.query(
    `SELECT * FROM game_player WHERE game_id=$1 ORDER BY name`,
    [gameId]
  );
  
  return rows;
}

/**
 * Get a specific player in a game
 * @param {string} gameId - Game UUID
 * @param {string} playerId - Player UUID
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object|null>} The player row or null
 */
export async function getPlayer(gameId, playerId, client = null) {
  const dbClient = client || pool;
  
  const { rows } = await dbClient.query(
    `SELECT * FROM game_player WHERE game_id=$1 AND id=$2`,
    [gameId, playerId]
  );
  
  return rows[0] ?? null;
}
