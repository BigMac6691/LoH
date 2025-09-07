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

export async function startGameFromSeed({ ownerId, seed, mapSize, densityMin, densityMax, title, description, players, status = 'lobby', params = {} })
{
  const client = await pool.connect();
  try
  {
    await client.query('BEGIN');

    const game = await createGame({ ownerId, seed, mapSize, densityMin, densityMax, title, description, params, status }, client);
    const turn = await openTurn({ gameId: game.id, number: 1 }, client);

    const model = await generateMap({ seed, mapSize, densityMin, densityMax });

    // insert stars
    const stars = model.getStars();
    for (const s of stars)
    {
      await client.query(
        `INSERT INTO star (id, game_id, star_id, name, sector_x, sector_y, pos_x, pos_y, pos_z, resource)
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [game.id, s.getId(), s.getName(), s.getSector().col, s.getSector().row, s.getPosition().x, s.getPosition().y, s.getPosition().z, s.getResourceValue()]
      );
    }

    // insert wormholes (ensure a<b for uniqueness)
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
        [game.id, wormholeId, aId, bId]
      );
    }

    // add players as provided
    const playersInserted = [];
    for (const p of players)
    {
      const row = await addPlayer({
        gameId: game.id,
        userId: p.userId ?? null,
        name: p.name,
        colorHex: p.colorHex,
        countryName: p.countryName ?? null
      }, client);
      playersInserted.push(row);
    }

    // deterministic initial ownership & ships using corner placements
    const sectors = model.getSectors();
    const sectorCount = sectors.length;
    const cornerSectors = [
      { sectorX: 0, sectorY: 0 },
      { sectorX: sectorCount - 1, sectorY: 0 },
      { sectorX: 0, sectorY: sectorCount - 1 },
      { sectorX: sectorCount - 1, sectorY: sectorCount - 1 }
    ];
    
    for (let i = 0; i < playersInserted.length && i < cornerSectors.length; i++)
    {
      const pl = playersInserted[i];
      const corner = cornerSectors[i];
      const sector = sectors[corner.sectorY][corner.sectorX];
      
      if (sector.stars.length > 0)
      {
        // Pick a random star from this sector
        const star = sector.stars[Math.floor(Math.random() * sector.stars.length)];
        
        // Update the star's resource value to 10 for fairness
        await client.query(
          `UPDATE star SET resource = 10 WHERE game_id = $1 AND star_id = $2`,
          [game.id, star.getId()]
        );
        
        await upsertStarState({
          gameId: game.id,
          starId: star.getId(),
          ownerPlayer: pl.id,
          economy: { industry: 10, available: 10, technology: 3 },
          damage: {}
        }, client);

        // optional: initial ships
        await addShip({
          gameId: game.id,
          ownerPlayer: pl.id,
          locationStarId: star.getId(),
          hp: 3,
          power: 3, // deterministic variance
          details: {}
        }, client);
      }
    }

    await logEvent({
      gameId: game.id,
      turnId: turn.id,
      kind: 'game_started',
      details: { seed, mapSize, players: playersInserted.map(p => ({ id: p.id, name: p.name })) }
    }, client);

    await client.query('COMMIT');
    return { game, turn, players: playersInserted, modelSummary: { stars: model.getStars().length, edges: model.getWormholes().length } };
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
