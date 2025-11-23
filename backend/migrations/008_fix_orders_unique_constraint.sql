-- Migration 008: Fix orders table unique constraint to allow multiple order types per player per turn
-- The previous constraint only allowed one order per player per turn total
-- Now we allow multiple orders per player per turn, but only one of each type

-- Step 1: Drop the old unique constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_game_id_turn_id_player_id_key;

-- Step 2: Add new unique constraint that includes order_type
ALTER TABLE orders ADD CONSTRAINT orders_game_turn_player_type_unique 
  UNIQUE (game_id, turn_id, player_id, order_type);

-- Step 3: Update comment to reflect the change
COMMENT ON TABLE orders IS 'Simplified orders table - one order per player per turn per type, no versioning';
