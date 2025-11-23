-- Migration 007: Simplify orders table by removing versioning complexity
-- This removes the draft/final workflow and revision tracking

-- Step 1: Create a new simplified orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  turn_id UUID NOT NULL REFERENCES game_turn(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES game_player(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- One order per player per turn
  UNIQUE(game_id, turn_id, player_id)
);

-- Step 2: Migrate existing final orders to the new table
-- We'll only keep the final orders, discarding all drafts
INSERT INTO orders (id, game_id, turn_id, player_id, order_type, payload, created_at)
SELECT 
  id,
  game_id,
  turn_id,
  player_id,
  order_type,
  payload,
  created_at
FROM order_submission 
WHERE is_final = true;

-- Step 3: Create indexes for the new simplified table
CREATE INDEX IF NOT EXISTS idx_orders_game_turn ON orders(game_id, turn_id);
CREATE INDEX IF NOT EXISTS idx_orders_player ON orders(game_id, turn_id, player_id);
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(game_id, turn_id, order_type);
CREATE INDEX IF NOT EXISTS idx_orders_payload_gin ON orders USING GIN (payload);

-- Step 4: Drop the old complex table and its indexes
DROP INDEX IF EXISTS uq_final_per_player_turn;
DROP INDEX IF EXISTS idx_orders_latest;
DROP INDEX IF EXISTS idx_orders_payload_gin;
DROP INDEX IF EXISTS idx_orders_turn_type;
DROP TABLE IF EXISTS order_submission;

-- Step 5: Add comment explaining the simplified design
COMMENT ON TABLE orders IS 'Simplified orders table - one order per player per turn, no versioning';
COMMENT ON COLUMN orders.payload IS 'Order data as JSONB - includes version and timestamp';
