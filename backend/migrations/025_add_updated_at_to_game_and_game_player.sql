-- Migration 025: Add updated_at columns to game and game_player tables
-- Add trigger for app_user.updated_at to make it automatic (remove manual updates)
-- These columns will be automatically updated by database triggers (never by code)
-- All timestamps use UTC (TIMESTAMPTZ)

-- Add updated_at column to game table
ALTER TABLE game
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add updated_at column to game_player table
ALTER TABLE game_player
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Create trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for app_user table (to replace manual updates)
DROP TRIGGER IF EXISTS update_app_user_updated_at ON app_user;
CREATE TRIGGER update_app_user_updated_at
    BEFORE UPDATE ON app_user
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for game table
DROP TRIGGER IF EXISTS update_game_updated_at ON game;
CREATE TRIGGER update_game_updated_at
    BEFORE UPDATE ON game
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for game_player table
DROP TRIGGER IF EXISTS update_game_player_updated_at ON game_player;
CREATE TRIGGER update_game_player_updated_at
    BEFORE UPDATE ON game_player
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON COLUMN app_user.updated_at IS 'Automatically updated timestamp (UTC) - set by database trigger on INSERT/UPDATE';
COMMENT ON COLUMN game.updated_at IS 'Automatically updated timestamp (UTC) - set by database trigger on INSERT/UPDATE';
COMMENT ON COLUMN game_player.updated_at IS 'Automatically updated timestamp (UTC) - set by database trigger on INSERT/UPDATE';
