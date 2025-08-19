// backend/src/repos/gamesRepo.js
import { pool } from '../db/pool.js';
import { randomUUID } from 'crypto';

/** Create a game (status starts 'lobby') */
export async function createGame({ ownerId, seed, mapSize, densityMin, densityMax, params = {} }) {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO game (id, owner_id, seed, map_size, density_min, density_max, params, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'lobby') RETURNING *`,
    [id, ownerId, seed, mapSize, densityMin, densityMax, params]
  );
  return rows[0];
}

export async function getGame(id) {
  const { rows } = await pool.query(`SELECT * FROM game WHERE id=$1`, [id]);
  return rows[0] ?? null;
}

export async function openTurn(gameId, number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } =
      await client.query(`SELECT * FROM game_turn WHERE game_id=$1 AND number=$2`, [gameId, number]);
    if (existing.length) { await client.query('COMMIT'); return existing[0]; }

    const { rows } = await client.query(
      `INSERT INTO game_turn (id, game_id, number, status) VALUES ($1,$2,$3,'open') RETURNING *`,
      [randomUUID(), gameId, number]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }
}

export async function closeTurn(gameId, number) {
  const { rows } = await pool.query(
    `UPDATE game_turn SET status='closed', closed_at=now()
     WHERE game_id=$1 AND number=$2 AND status='open' RETURNING *`,
    [gameId, number]
  );
  return rows[0] ?? null;
}
