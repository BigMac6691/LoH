-- Migration 009: Add sequence number to orders table to support multiple orders of the same type
-- This allows players to submit multiple move orders (or build orders) per turn

-- Step 1: Add sequence column
ALTER TABLE orders ADD COLUMN sequence INT NOT NULL DEFAULT 0;

-- Step 2: Drop old unique constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_game_turn_player_type_unique;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_game_id_turn_id_player_id_key;

-- Step 3: Add new unique constraint with sequence
ALTER TABLE orders ADD CONSTRAINT orders_game_turn_player_type_sequence_unique 
  UNIQUE (game_id, turn_id, player_id, order_type, sequence);

-- Step 4: Update comment
COMMENT ON TABLE orders IS 'Orders table - multiple orders per player per turn per type, differentiated by sequence number';
