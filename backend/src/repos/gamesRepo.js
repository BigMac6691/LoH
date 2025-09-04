// backend/src/repos/gamesRepo.js
import { pool } from '../db/pool.js';
import { randomUUID } from 'crypto';

/**
 * Create a new game
 * @param {Object} params
 * @param {string} params.ownerId - Owner user UUID
 * @param {string} params.seed - Game seed
 * @param {number} params.mapSize - Map size (2-9)
 * @param {number} params.densityMin - Minimum star density
 * @param {number} params.densityMax - Maximum star density
 * @param {string} params.title - Game title
 * @param {string} params.description - Game description
 * @param {Object} params.params - Additional game parameters
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object>} The created game row
 */
export async function createGame({ ownerId, seed, mapSize, densityMin, densityMax, title, description, params = {} }, client = null) {
  const id = randomUUID();
  const dbClient = client || pool;
  
  // Debug logging
  console.log('createGame called with:', { ownerId, seed, mapSize, densityMin, densityMax, title, description, params });
  
  const { rows } = await dbClient.query(
    `INSERT INTO game (id, owner_id, seed, map_size, density_min, density_max, title, description, params, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'lobby') RETURNING *`,
    [id, ownerId, seed, mapSize, densityMin, densityMax, title, description, params]
  );
  
  return rows[0];
}

/**
 * Get a game by ID
 * @param {string} id - Game UUID
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object|null>} The game row or null
 */
export async function getGame(id, client = null) {
  const dbClient = client || pool;
  
  const { rows } = await dbClient.query(
    `SELECT * FROM game WHERE id=$1`,
    [id]
  );
  
  return rows[0] ?? null;
}

/**
 * Update game status
 * @param {Object} params
 * @param {string} params.id - Game UUID
 * @param {string} params.status - New status ('lobby'|'running'|'paused'|'finished')
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object|null>} The updated game row or null
 */
export async function updateGameStatus({ id, status }, client = null) {
  const dbClient = client || pool;
  
  const { rows } = await dbClient.query(
    `UPDATE game SET status=$2 WHERE id=$1 RETURNING *`,
    [id, status]
  );
  
  return rows[0] ?? null;
}

/**
 * Get all games
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Array>} Array of all game rows
 */
export async function listGames(client = null) {
  const dbClient = client || pool;
  
  const { rows } = await dbClient.query(
    `SELECT * FROM game ORDER BY created_at DESC`
  );
  
  return rows;
}

/**
 * Get games by scenario (dev scenario type)
 * @param {string} scenario - Scenario name to search for
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Array>} Array of games with matching scenario
 */
export async function getGamesByScenario(scenario, client = null) {
  const dbClient = client || pool;
  
  const { rows } = await dbClient.query(
    `SELECT * FROM game 
     WHERE params->>'type' = 'devScenario' 
     AND params->>'scenario' = $1 
     ORDER BY created_at DESC`,
    [scenario]
  );
  
  return rows;
}

/**
 * Update game params (for scenario state updates)
 * @param {Object} params
 * @param {string} params.id - Game UUID
 * @param {Object} params.newParams - New params object to merge
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object|null>} The updated game row or null
 */
export async function updateGameParams({ id, newParams }, client = null) {
  const dbClient = client || pool;
  
  // Get current params and merge with new ones
  const { rows: currentRows } = await dbClient.query(
    `SELECT params FROM game WHERE id = $1`,
    [id]
  );
  
  if (currentRows.length === 0) {
    return null;
  }
  
  const currentParams = currentRows[0].params || {};
  const mergedParams = { ...currentParams, ...newParams };
  
  const { rows } = await dbClient.query(
    `UPDATE game SET params = $2 WHERE id = $1 RETURNING *`,
    [id, mergedParams]
  );
  
  return rows[0] ?? null;
}
