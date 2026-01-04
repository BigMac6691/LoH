-- Migration 024: Add status_reason column to game_player table
-- This enables tracking the reason for player status changes (e.g., why a player was suspended or ejected)

-- Step 1: Add status_reason column (nullable)
ALTER TABLE game_player
ADD COLUMN IF NOT EXISTS status_reason TEXT;

-- Step 2: Set status_reason to NULL for all existing players (safety measure)
UPDATE game_player
SET status_reason = NULL
WHERE status_reason IS NOT NULL;

-- Step 3: Add comment
COMMENT ON COLUMN game_player.status_reason IS 'Reason for current player status, especially useful for suspended/ejected statuses to explain the action taken.';

