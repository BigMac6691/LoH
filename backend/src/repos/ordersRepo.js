// backend/src/repos/ordersRepo.js
import { pool } from '../db/pool.js';
import { randomUUID } from 'crypto';

export async function upsertDraftOrder({ gameId, turnId, playerId, orderType, payload }) {
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO order_submission (id, game_id, turn_id, player_id, order_type, payload, is_final)
     VALUES ($1,$2,$3,$4,$5,$6,false) RETURNING *`,
    [id, gameId, turnId, playerId, orderType, payload]
  );
  return rows[0];
}

export async function submitFinalOrder({ gameId, turnId, playerId, orderType, payload }) {
  const id = randomUUID();
  await pool.query(
    `UPDATE order_submission
        SET is_final=false
      WHERE game_id=$1 AND turn_id=$2 AND player_id=$3 AND is_final=true`,
    [gameId, turnId, playerId]
  );
  const { rows } = await pool.query(
    `INSERT INTO order_submission (id, game_id, turn_id, player_id, order_type, payload, is_final)
     VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *`,
    [id, gameId, turnId, playerId, orderType, payload]
  );
  return rows[0];
}

export async function listFinalOrdersForTurn(gameId, turnId) {
  const { rows } = await pool.query(
    `SELECT * FROM order_submission
      WHERE game_id=$1 AND turn_id=$2 AND is_final=true
      ORDER BY created_at`,
    [gameId, turnId]
  );
  return rows;
}
