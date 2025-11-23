-- Migration 012: Rename star_state.damage column to details
-- This makes the column name more generic to support various state information

-- Rename the column
ALTER TABLE star_state RENAME COLUMN damage TO details;

-- Add comment explaining the change
COMMENT ON COLUMN star_state.details IS 'Additional state information (damage, destruction, etc.)';
