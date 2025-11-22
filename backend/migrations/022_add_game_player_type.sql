-- Migration 022: Add 'type' column to game_player table to distinguish human players from AI players
-- This fixes the bug where AI players appear in "Games Playing" view because they share the same user_id

-- Step 1: Add type column with default 'player' for backward compatibility
ALTER TABLE game_player
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'player';

-- Step 2: Add CHECK constraint for valid types
ALTER TABLE game_player
ADD CONSTRAINT chk_game_player_type 
CHECK (type IN ('player', 'ai'));

-- Step 3: Update existing AI players (identified by having main_ai in meta)
UPDATE game_player
SET type = 'ai'
WHERE meta::text LIKE '%"main_ai"%' OR meta::text LIKE '%main_ai%';

-- Step 4: Add comment
COMMENT ON COLUMN game_player.type IS 'Player type: player (human) or ai (AI-controlled). Used to filter AI players from user-specific queries.';

