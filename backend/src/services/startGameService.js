import { randomUUID } from 'crypto';
import { pool } from '../db/pool.js';
import { createGame } from '../repos/gamesRepo.js';
import { openTurn } from '../repos/turnsRepo.js';
import { addPlayer } from '../repos/playersRepo.js';
import { upsertStarState } from '../repos/starsRepo.js';
import { addShip } from '../repos/shipsRepo.js';
import { logEvent } from '../repos/eventsRepo.js';
import { generateMap } from '../MapFactory.js';

export async function createEmptyGame({ ownerId, seed, mapSize, densityMin, densityMax, title, description, status, params = {} })
{
  const client = await pool.connect();
  try
  {
    await client.query('BEGIN');

    const game = await createGame({ ownerId, seed, mapSize, densityMin, densityMax, title, description, params, status }, client);

    await client.query('COMMIT');
    return { game };
  }
  catch (e)
  {
    await client.query('ROLLBACK');
    throw e;
  }
  finally
  {
    client.release();
  }
}

export async function generateMapForGame({ gameId })
{
  const client = await pool.connect();
  try
  {
    await client.query('BEGIN');

    // Get the game to verify it exists and retrieve all parameters
    const { rows: gameRows } = await client.query('SELECT * FROM game WHERE id = $1', [gameId]);
    if (gameRows.length === 0) {
      throw new Error(`Game with ID ${gameId} not found`);
    }
    
    const game = gameRows[0];
    
    // Extract map generation parameters from the game record
    const { seed, map_size: mapSize, density_min: densityMin, density_max: densityMax } = game;
    
    // Validate that all required parameters are present
    if (!seed || !mapSize || densityMin === undefined || densityMax === undefined) {
      throw new Error(`Game ${gameId} is missing required map generation parameters: seed, mapSize, densityMin, densityMax`);
    }

    // Generate the map model using the game's parameters
    const model = await generateMap({ seed, mapSize, densityMin, densityMax });

    // Insert stars
    const stars = model.getStars();
    for (const s of stars)
    {
      await client.query(
        `INSERT INTO star (id, game_id, star_id, name, sector_x, sector_y, pos_x, pos_y, pos_z, resource)
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [gameId, s.getId(), s.getName(), s.getSector().col, s.getSector().row, s.getPosition().x, s.getPosition().y, s.getPosition().z, s.getResourceValue()]
      );
    }

    // Insert wormholes (ensure a<b for uniqueness)
    const wormholes = model.getWormholes();
    for (const w of wormholes)
    {
      const a = w.star1.getId();
      const b = w.star2.getId();
      const aId = a < b ? a : b;
      const bId = a < b ? b : a;
      const wormholeId = `EDGE_${aId}_${bId}`;
      await client.query(
        `INSERT INTO wormhole (id, game_id, wormhole_id, star_a_id, star_b_id)
         VALUES (gen_random_uuid(),$1,$2,$3,$4)`,
        [gameId, wormholeId, aId, bId]
      );
    }

    await client.query('COMMIT');
    return { 
      gameId, 
      starsCount: stars.length, 
      wormholesCount: wormholes.length,
      modelSummary: { stars: stars.length, edges: wormholes.length }
    };
  }
  catch (e)
  {
    await client.query('ROLLBACK');
    throw e;
  }
  finally
  {
    client.release();
  }
}


/**
 * Place players on the map for a game
 * @param {Object} params
 * @param {string} params.gameId - Game ID
 * @returns {Promise<Object>} Result with playersPlaced count
 */
export async function placePlayersForGame({ gameId }) {
  const client = await pool.connect();
  
  try {
    console.log(`🎮 startGameService: Placing players for game: ${gameId}`);
    
    // Get all game players
    const { rows: players } = await client.query(
      `SELECT * FROM game_player WHERE game_id = $1`,
      [gameId]
    );
    
    if (players.length === 0) {
      throw new Error('No players found for game');
    }
    
    // Get all stars for the game
    const { rows: stars } = await client.query(
      `SELECT * FROM star WHERE game_id = $1`,
      [gameId]
    );
    
    if (stars.length === 0) {
      throw new Error('No stars found for game');
    }
    
    let playersPlaced = 0;
    
    // Place each player on a random unowned star
    for (const player of players) {
      let placed = false;
      let attempts = 0;
      const maxAttempts = 100; // Prevent infinite loop

      console.log(`🎮 startGameService: Placing player ${player.user_id} on game ${gameId}`);
      
      while (!placed && attempts < maxAttempts) {
        // Pick a random star
        const randomStar = stars[Math.floor(Math.random() * stars.length)];

        console.log(`🎮 startGameService: Picking random star ${randomStar.star_id}`);
        
        // Check if star is already owned
        const { rows: existingOwner } = await client.query(
          `SELECT owner_player FROM star_state WHERE game_id = $1 AND star_id = $2`,
          [gameId, randomStar.star_id]
        );

        console.log(`🎮 startGameService: Checking if star ${randomStar.star_id} is owned by ${existingOwner.length > 0 ? existingOwner[0].owner_player : 'none'}`);
        
        if (existingOwner.length === 0 || !existingOwner[0].owner_player) {
          // Star is unowned, place player here
          
          // Update star resource value to 10
          await client.query(
            `UPDATE star SET resource = 10 WHERE game_id = $1 AND star_id = $2`,
            [gameId, randomStar.star_id]
          );
          
          // Update star_state with owner and economy
          await upsertStarState({
            gameId: gameId,
            starId: randomStar.star_id,
            ownerPlayer: player.id,
            economy: { industry: 10, available: 10, technology: 3 },
            details: {}
          }, client);
          
          // Create three ships for the player at their home star
          for (let shipIndex = 0; shipIndex < 3; shipIndex++) {
            await addShip({
              gameId: gameId,
              ownerPlayer: player.id,
              locationStarId: randomStar.star_id,
              hp: 3,
              power: 3,
              details: {}
            }, client);
          }
          
          console.log(`🎮 startGameService: Placed player ${player.user_id} on star ${randomStar.star_id} with 3 ships`);
          playersPlaced++;
          placed = true;
        } else {
          // Star is owned, try again
          attempts++;
        }
      }
      
      if (!placed) {
        throw new Error(`Could not find unowned star for player ${player.user_id} after ${maxAttempts} attempts`);
      }
    }
    
    console.log(`🎮 startGameService: Successfully placed ${playersPlaced} players`);
    
    return {
      playersPlaced: playersPlaced
    };
    
  } catch (error) {
    console.error('🎮 startGameService: Error placing players:', error);
    throw error;
  } finally {
    client.release();
  }
}