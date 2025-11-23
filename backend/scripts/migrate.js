// backend/scripts/migrate.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/db/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIG_DIR = path.resolve(__dirname, '../migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function appliedSet() {
  const { rows } = await pool.query(`SELECT filename FROM _migrations ORDER BY id`);
  return new Set(rows.map(r => r.filename));
}

async function applyOne(file) {
  const sql = fs.readFileSync(path.join(MIG_DIR, file), 'utf8');
  console.log(`\n--- Applying ${file} ---`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(`INSERT INTO _migrations (filename) VALUES ($1)`, [file]);
    await client.query('COMMIT');
    console.log(`Applied: ${file}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(`Failed: ${file}\n`, e);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

async function main() {
  await ensureMigrationsTable();
  const files = fs.readdirSync(MIG_DIR)
    .filter(f => f.match(/^\d+_.*\.sql$/))
    .sort();
  const done = await appliedSet();
  for (const f of files) {
    if (!done.has(f)) await applyOne(f);
  }
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
