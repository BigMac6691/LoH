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
 * @param {Object} params.details - Additional state details (default: {})
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object>} The upserted star state row
 */
export async function upsertStarState({ gameId, starId, ownerPlayer = null, economy = {}, details = {} }, client = null) {
  const id = randomUUID();
  const dbClient = client || pool;
  
  const { rows } = await dbClient.query(
    `INSERT INTO star_state (id, game_id, star_id, owner_player, economy, details)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (game_id, star_id)
     DO UPDATE SET owner_player=EXCLUDED.owner_player,
                   economy=EXCLUDED.economy,
                   details=EXCLUDED.details,
                   updated_at=now()
     RETURNING *`,
    [id, gameId, starId, ownerPlayer, economy, details]
  );
  
  return rows[0];
}

/**
 * Get star state by game and star ID
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.starId - Star ID
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object|null>} The star state row or null
 */
export async function getStarState({ gameId, starId }, client = null) {
  const dbClient = client || pool;
  
  const { rows } = await dbClient.query(
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
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Array>} Array of star state rows
 */
export async function listStarsByOwner({ gameId, playerId }, client = null) {
  const dbClient = client || pool;
  
  const { rows } = await dbClient.query(
    `SELECT * FROM star_state WHERE game_id=$1 AND owner_player=$2`,
    [gameId, playerId]
  );
  
  return rows;
}

/**
 * Get standing orders for a star
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.starId - Star ID
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object|null>} Standing orders object or null if not found
 */
export async function getStandingOrders({ gameId, starId }, client = null) {
  const dbClient = client || pool;
  
  const starState = await getStarState({ gameId, starId }, dbClient);
  if (!starState || !starState.details || !starState.details.standingOrders) {
    return null;
  }
  
  return starState.details.standingOrders;
}

/**
 * Set standing orders for a star
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.starId - Star ID
 * @param {Object} params.standingOrders - Standing orders object to save
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object>} Updated star state row
 */
export async function setStandingOrders({ gameId, starId, standingOrders }, client = null) {
  const dbClient = client || pool;
  
  const starState = await getStarState({ gameId, starId }, dbClient);
  if (!starState) {
    throw new Error(`Star state not found for game ${gameId}, star ${starId}`);
  }
  
  const currentDetails = starState.details || {};
  const existingStandingOrders = currentDetails.standingOrders || {};

  console.log('🏭 StandingOrdersService: Existing standing orders:', existingStandingOrders);
  
  // Merge new standing orders with existing ones
  // This allows industry and move orders to coexist
  const updatedStandingOrders = {
    ...existingStandingOrders,
    ...standingOrders
  };

  // Remove properties that are explicitly set to null or undefined
  // This allows clients to delete specific standing orders
  for (const key in updatedStandingOrders)
  {
    if (updatedStandingOrders[key] === null || updatedStandingOrders[key] === undefined)
    {
      delete updatedStandingOrders[key];
    }
  }

  // Also check if properties are missing from the new standingOrders
  // If a property exists in existing but not in new, and new is a partial update,
  // we need to determine if it should be removed
  // For now, we'll only remove properties explicitly set to null
  // If a property is missing from new standingOrders, it's preserved from existing

  console.log('🏭 StandingOrdersService: Updated standing orders:', updatedStandingOrders);
  
  const updatedDetails = {
    ...currentDetails,
    standingOrders: updatedStandingOrders
  };
  
  console.log('🏭 StandingOrdersService: Updated details:', updatedDetails);
  
  // Use upsertStarState but preserve existing economy and owner
  return await upsertStarState({
    gameId,
    starId,
    ownerPlayer: starState.owner_player,
    economy: starState.economy,
    details: updatedDetails
  }, dbClient);
}

/**
 * Clear standing orders for a star
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {string} params.starId - Star ID
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Object>} Updated star state row
 */
export async function clearStandingOrders({ gameId, starId }, client = null) {
  const dbClient = client || pool;
  
  const starState = await getStarState({ gameId, starId }, dbClient);
  if (!starState) {
    throw new Error(`Star state not found for game ${gameId}, star ${starId}`);
  }
  
  const currentDetails = starState.details || {};
  const { standingOrders, ...updatedDetails } = currentDetails;
  
  // Use upsertStarState but preserve existing economy and owner
  return await upsertStarState({
    gameId,
    starId,
    ownerPlayer: starState.owner_player,
    economy: starState.economy,
    details: updatedDetails
  }, dbClient);
}

/**
 * Get all stars with standing orders for a game
 * @param {Object} params
 * @param {string} params.gameId - Game UUID
 * @param {Object} [client] - Optional database client for transactions
 * @returns {Promise<Array>} Array of star state rows that have standing orders
 */
export async function getStarsWithStandingOrders({ gameId }, client = null) {
  const dbClient = client || pool;
  
  const { rows } = await dbClient.query(
    `SELECT * FROM star_state 
     WHERE game_id = $1 
     AND details->'standingOrders' IS NOT NULL
     AND jsonb_typeof(details->'standingOrders') = 'object'`,
    [gameId]
  );
  
  return rows;
}
