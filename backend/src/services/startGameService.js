import { randomUUID } from 'crypto';
import { pool } from '../db/pool.js';
import { createGame } from '../repos/gamesRepo.js';
import { openTurn } from '../repos/turnsRepo.js';
import { addPlayer } from '../repos/playersRepo.js';
import { upsertStarState } from '../repos/starsRepo.js';
import { addShip } from '../repos/shipsRepo.js';
import { logEvent } from '../repos/eventsRepo.js';
import { generateMap } from '@loh/shared';

export async function startGameFromSeed({ ownerId, seed, mapSize, densityMin, densityMax, title, description, players }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const game = await createGame({ ownerId, seed, mapSize, densityMin, densityMax, title, description, params: {} }, client);
    const turn = await openTurn({ gameId: game.id, number: 1 }, client);

    const model = generateMap({ seed, mapSize, densityMin, densityMax });

    // insert stars
    for (const s of model.stars) {
      await client.query(
        `INSERT INTO star (id, game_id, star_id, name, sector_x, sector_y, pos_x, pos_y, pos_z)
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8)`,
        [game.id, s.id, s.name, s.sectorX, s.sectorY, s.x, s.y, s.z]
      );
    }

    // insert wormholes (ensure a<b for uniqueness)
    for (const e of model.edges) {
      const a = e.aStarId < e.bStarId ? e.aStarId : e.bStarId;
      const b = e.aStarId < e.bStarId ? e.bStarId : e.aStarId;
      const wormholeId = `EDGE_${a}_${b}`;
      await client.query(
        `INSERT INTO wormhole (id, game_id, wormhole_id, star_a_id, star_b_id)
         VALUES (gen_random_uuid(),$1,$2,$3,$4)`,
        [game.id, wormholeId, a, b]
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

    // deterministic initial ownership & ships using suggested placements
    for (let i = 0; i < playersInserted.length && i < model.suggestedPlayers.length; i++) {
      const pl = playersInserted[i];
      const spot = model.suggestedPlayers[i];
      await upsertStarState({
        gameId: game.id,
        starId: spot.starId,
        ownerPlayer: pl.id,
        economy: { resource: 2, industry: 0 },
        damage: {}
      }, client);

      // optional: initial ships
      await addShip({
        gameId: game.id,
        ownerPlayer: pl.id,
        locationStarId: spot.starId,
        hp: 100,
        power: 10 - i, // deterministic variance
        details: { seed }
      }, client);
    }

    await logEvent({
      gameId: game.id,
      turnId: turn.id,
      kind: 'game_started',
      details: { seed, mapSize, players: playersInserted.map(p => ({ id: p.id, name: p.name })) }
    }, client);

    await client.query('COMMIT');
    return { game, turn, players: playersInserted, modelSummary: { stars: model.stars.length, edges: model.edges.length } };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
