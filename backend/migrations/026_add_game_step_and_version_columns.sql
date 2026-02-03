-- Migration 026: Add step tracking and versioning to game and game_player
-- All timestamps use UTC (TIMESTAMPTZ)

-- Add step tracking columns to game table
ALTER TABLE game
ADD COLUMN IF NOT EXISTS step_started_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS step_attempt INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

-- Add version column to game_player table
ALTER TABLE game_player
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

-- Create trigger functions to automatically update updated_at and increment version
CREATE OR REPLACE FUNCTION update_game_updated_at_and_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.version = COALESCE(OLD.version, 0) + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_game_player_updated_at_and_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.version = COALESCE(OLD.version, 0) + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace triggers for game and game_player to use versioning functions
DROP TRIGGER IF EXISTS update_game_updated_at ON game;
CREATE TRIGGER update_game_updated_at
    BEFORE UPDATE ON game
    FOR EACH ROW
    EXECUTE FUNCTION update_game_updated_at_and_version();

DROP TRIGGER IF EXISTS update_game_player_updated_at ON game_player;
CREATE TRIGGER update_game_player_updated_at
    BEFORE UPDATE ON game_player
    FOR EACH ROW
    EXECUTE FUNCTION update_game_player_updated_at_and_version();

-- Add comments
COMMENT ON COLUMN game.step_started_at IS 'Current step start timestamp (UTC), nullable when idle';
COMMENT ON COLUMN game.step_attempt IS 'Current step attempt counter';
COMMENT ON COLUMN game.version IS 'Monotonic version incremented by update trigger';
COMMENT ON COLUMN game_player.version IS 'Monotonic version incremented by update trigger';
