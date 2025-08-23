-- Immutable generated stars for a game
CREATE TABLE IF NOT EXISTS star (
  id TEXT PRIMARY KEY,            -- e.g., STAR_3_1_0 (deterministic)
  game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sector_x INT NOT NULL,
  sector_y INT NOT NULL,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL,
  pos_z REAL NOT NULL,
  UNIQUE (game_id, id)
);
CREATE INDEX IF NOT EXISTS idx_star_game ON star(game_id);
CREATE INDEX IF NOT EXISTS idx_star_sector ON star(game_id, sector_x, sector_y);

-- Wormhole edges (undirected; store min/max ordering)
CREATE TABLE IF NOT EXISTS wormhole (
  id TEXT PRIMARY KEY,            -- e.g., EDGE_STAR_A_STAR_B
  game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  star_a_id TEXT NOT NULL,
  star_b_id TEXT NOT NULL,
  UNIQUE (game_id, star_a_id, star_b_id),
  CHECK (star_a_id <> star_b_id)
);
CREATE INDEX IF NOT EXISTS idx_wormhole_game ON wormhole(game_id);
