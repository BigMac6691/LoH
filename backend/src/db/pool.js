// backend/src/db/pool.js
import pg from 'pg';

const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Optional hardening/timeouts:
  // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  // idleTimeoutMillis: 30_000,
  // connectionTimeoutMillis: 10_000,
});
