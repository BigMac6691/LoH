-- Migration 018: Add frozen status to game and suspended/ejected to game_player
-- This enables game management features: freezing games and suspending/ejecting players

-- Step 1: Drop existing game status constraint
DO $$
BEGIN
  -- Check if there's an existing constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'game_status_check'
    AND conrelid = 'game'::regclass
  ) THEN
    ALTER TABLE game DROP CONSTRAINT game_status_check;
  END IF;
END $$;

-- Step 2: Add new constraint with frozen status
ALTER TABLE game
ADD CONSTRAINT game_status_check
CHECK (status IN ('lobby', 'running', 'paused', 'frozen', 'finished'));

-- Step 3: Add CHECK constraint for game_player status
-- First, update any invalid statuses to 'active' (safety measure)
UPDATE game_player
SET status = 'active'
WHERE status IS NULL OR status NOT IN ('active', 'waiting', 'suspended', 'ejected');

-- Step 4: Add the constraint
ALTER TABLE game_player
ADD CONSTRAINT game_player_status_check
CHECK (status IN ('active', 'waiting', 'suspended', 'ejected'));

-- Add comments
COMMENT ON COLUMN game.status IS 'Game status: lobby (setup), running (active), paused (can view but no orders), frozen (cannot load), finished (view only, no changes)';
COMMENT ON COLUMN game_player.status IS 'Player status: active (can play), waiting (turn ended), suspended (cannot load game), ejected (final, removed from game)';

