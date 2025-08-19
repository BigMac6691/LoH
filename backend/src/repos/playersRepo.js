// backend/src/repos/playersRepo.js
import { pool } from '../db/pool.js';
import { randomUUID } from 'crypto';

export async function addPlayer({ gameId, userId, name, colorHex, countryName = null }) {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO game_player (id, game_id, user_id, name, color_hex, country_name)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, gameId, userId, name, colorHex, countryName]
  );
  return rows[0];
}

export async function listPlayers(gameId) {
  const { rows } = await pool.query(
    `SELECT * FROM game_player WHERE game_id=$1 ORDER BY name`, [gameId]
  );
  return rows;
}
