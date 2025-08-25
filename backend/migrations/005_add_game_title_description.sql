-- Migration 005: Add title and description columns to game table
-- Delete all existing data and add new non-nullable columns

-- First, delete all existing data (this will cascade to all related tables)
DELETE FROM game;

-- Add the new columns
ALTER TABLE game 
ADD COLUMN title TEXT NOT NULL DEFAULT 'Untitled Game',
ADD COLUMN description TEXT NOT NULL DEFAULT 'No description provided';

-- Remove the default constraints after adding the columns
ALTER TABLE game 
ALTER COLUMN title DROP DEFAULT,
ALTER COLUMN description DROP DEFAULT;
