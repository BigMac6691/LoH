-- Users
CREATE TABLE IF NOT EXISTS app_user (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Game
CREATE TABLE IF NOT EXISTS game (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES app_user(id),
  seed TEXT NOT NULL,
  map_size INT NOT NULL CHECK (map_size BETWEEN 2 AND 9),
  density_min INT NOT NULL,
  density_max INT NOT NULL,
  rules_version TEXT NOT NULL DEFAULT 'v1',
  status TEXT NOT NULL CHECK (status IN ('lobby','running','paused','finished')),
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ
);

-- Turns
CREATE TABLE IF NOT EXISTS game_turn (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  number INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','resolving','closed')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  UNIQUE (game_id, number)
);
CREATE INDEX IF NOT EXISTS idx_turn_status ON game_turn(game_id, status);

-- Players
CREATE TABLE IF NOT EXISTS game_player (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  user_id UUID REFERENCES app_user(id),
  name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  country_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (game_id, name),
  UNIQUE (game_id, color_hex)
);

-- Orders (append-only with revisions)
CREATE TABLE IF NOT EXISTS order_submission (
  id UUID PRIMARY KEY,
  game_id   UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  turn_id   UUID NOT NULL REFERENCES game_turn(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES game_player(id) ON DELETE CASCADE,

  -- Logical identity for an order edited over time; new orders get a new client_order_id
  client_order_id UUID NOT NULL,
  revision INT NOT NULL DEFAULT 1,

  order_type TEXT NOT NULL,   -- 'move','industry','research',...
  payload JSONB NOT NULL,     -- include {version:'v1', ...}
  is_deleted BOOLEAN NOT NULL DEFAULT false,

  is_final BOOLEAN NOT NULL DEFAULT false,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One final submission per (game,turn,player) enforced by partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_final_per_player_turn
  ON order_submission (game_id, turn_id, player_id)
  WHERE is_final;

-- Fast "latest draft per logical order" ordering
CREATE INDEX IF NOT EXISTS idx_orders_latest
  ON order_submission (game_id, turn_id, player_id, client_order_id, revision DESC);

-- GIN on payload for flexible querying
CREATE INDEX IF NOT EXISTS idx_orders_payload_gin
  ON order_submission USING GIN (payload);

-- Per-star state deltas
CREATE TABLE IF NOT EXISTS star_state (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  star_id TEXT NOT NULL,
  owner_player UUID REFERENCES game_player(id),
  economy JSONB NOT NULL DEFAULT '{}'::jsonb,
  damage  JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, star_id)
);
CREATE INDEX IF NOT EXISTS idx_star_owner ON star_state(game_id, owner_player);

-- Ships
CREATE TABLE IF NOT EXISTS ship (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  owner_player UUID NOT NULL REFERENCES game_player(id),
  location_star_id TEXT NOT NULL,
  hp INT NOT NULL,
  power INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_ship_loc   ON ship(game_id, location_star_id);
CREATE INDEX IF NOT EXISTS idx_ship_owner ON ship(game_id, owner_player);

-- Turn resolution events (also used for combat logs)
CREATE TABLE IF NOT EXISTS turn_resolution_event (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  turn_id UUID NOT NULL REFERENCES game_turn(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  kind TEXT NOT NULL,         -- 'move','combat','production',...
  details JSONB NOT NULL,     -- store your seeded RNG steps, rolls, outcomes, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (turn_id, seq)
);

-- GIN on combat/event details for querying specific combats
CREATE INDEX IF NOT EXISTS idx_tre_details_gin
  ON turn_resolution_event USING GIN (details);

-- Migrations bookkeeping
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  filename TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
