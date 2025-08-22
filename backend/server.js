import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { pool } from './src/db/pool.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const port = process.env.PORT || 3000;

app.get('/api/health', async (_req, res) => {
  try {
    const r = await pool.query('select 1 as ok');
    res.json({ ok: r.rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.listen(port, () => {
  console.log(`API listening on ${port}`);
});
