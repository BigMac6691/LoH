-- Migration 014: Add max_players column to game table
-- This allows games to have a maximum player limit for joining

-- Add max_players column with default value
ALTER TABLE game 
ADD COLUMN IF NOT EXISTS max_players INT NOT NULL DEFAULT 6;

-- Add CHECK constraint to ensure valid values
ALTER TABLE game
ADD CONSTRAINT check_max_players 
CHECK (max_players > 0 AND max_players <= 20);

-- Add comment
COMMENT ON COLUMN game.max_players IS 'Maximum number of players allowed in this game';

