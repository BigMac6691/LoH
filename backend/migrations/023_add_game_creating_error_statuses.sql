-- Migration 023: Add 'creating' and 'error' statuses to game table, plus substatus and status_reason columns
-- This enables tracking game creation progress and error states

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

-- Step 2: Add new constraint with creating and error statuses
ALTER TABLE game
ADD CONSTRAINT game_status_check
CHECK (status IN ('lobby', 'creating', 'running', 'paused', 'frozen', 'finished', 'error'));

-- Step 3: Add substatus column (nullable)
ALTER TABLE game
ADD COLUMN IF NOT EXISTS substatus TEXT;

-- Step 4: Add CHECK constraint for substatus
ALTER TABLE game
ADD CONSTRAINT game_substatus_check
CHECK (substatus IS NULL OR substatus IN ('generating_map', 'placing_players', 'creating_turn'));

-- Step 5: Add status_reason column (nullable)
ALTER TABLE game
ADD COLUMN IF NOT EXISTS status_reason TEXT;

-- Step 6: Set substatus and status_reason to NULL for all existing games (safety measure)
UPDATE game
SET substatus = NULL, status_reason = NULL
WHERE substatus IS NOT NULL OR status_reason IS NOT NULL;

-- Step 7: Update comments
COMMENT ON COLUMN game.status IS 'Game status: lobby (setup), creating (in progress), running (active), paused (can view but no orders), frozen (cannot load), finished (view only, no changes), error (creation failed)';
COMMENT ON COLUMN game.substatus IS 'Game substatus: generating_map (creating map), placing_players (placing players on map), creating_turn (creating initial turn). Only set when status is "creating".';
COMMENT ON COLUMN game.status_reason IS 'Reason for current status, especially useful for error status to explain what went wrong.';

