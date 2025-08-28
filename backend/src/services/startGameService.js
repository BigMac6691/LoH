import { randomUUID } from 'crypto';
import { pool } from '../db/pool.js';
import { createGame } from '../repos/gamesRepo.js';
import { openTurn } from '../repos/turnsRepo.js';
import { addPlayer } from '../repos/playersRepo.js';
import { upsertStarState } from '../repos/starsRepo.js';
import { addShip } from '../repos/shipsRepo.js';
import { logEvent } from '../repos/eventsRepo.js';
import { generateMap } from '../MapFactory.js';

export async function startGameFromSeed({ ownerId, seed, mapSize, densityMin, densityMax, title, description, players }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const game = await createGame({ ownerId, seed, mapSize, densityMin, densityMax, title, description, params: {} }, client);
    const turn = await openTurn({ gameId: game.id, number: 1 }, client);

    const model = await generateMap({ seed, mapSize, densityMin, densityMax });

    // insert stars
    const stars = model.getStars();
    for (const s of stars) {
      await client.query(
        `INSERT INTO star (id, game_id, star_id, name, sector_x, sector_y, pos_x, pos_y, pos_z)
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8)`,
        [game.id, s.getId(), s.getName(), s.getSector().col, s.getSector().row, s.getPosition().x, s.getPosition().y, s.getPosition().z]
      );
    }

    // insert wormholes (ensure a<b for uniqueness)
    const wormholes = model.getWormholes();
    for (const w of wormholes) {
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
    for (const p of players) {
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
    const mapSize = sectors.length;
    const cornerSectors = [
      { sectorX: 0, sectorY: 0 },
      { sectorX: mapSize - 1, sectorY: 0 },
      { sectorX: 0, sectorY: mapSize - 1 },
      { sectorX: mapSize - 1, sectorY: mapSize - 1 }
    ];
    
    for (let i = 0; i < playersInserted.length && i < cornerSectors.length; i++) {
      const pl = playersInserted[i];
      const corner = cornerSectors[i];
      const sector = sectors[corner.sectorY][corner.sectorX];
      
      if (sector.stars.length > 0) {
        // Pick a random star from this sector
        const star = sector.stars[Math.floor(Math.random() * sector.stars.length)];
        
        await upsertStarState({
          gameId: game.id,
          starId: star.getId(),
          ownerPlayer: pl.id,
          economy: { resource: 2, industry: 0 },
          damage: {}
        }, client);

        // optional: initial ships
        await addShip({
          gameId: game.id,
          ownerPlayer: pl.id,
          locationStarId: star.getId(),
          hp: 100,
          power: 10 - i, // deterministic variance
          details: { seed }
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
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
