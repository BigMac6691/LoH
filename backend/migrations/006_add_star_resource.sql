-- Migration 006: Add resource column to star table
-- Move resource value from economy to star table as it's fixed and unchangeable

-- Add resource column to star table
ALTER TABLE star ADD COLUMN resource DOUBLE PRECISION NOT NULL DEFAULT 50.0 CHECK (resource BETWEEN 0.0 AND 100.0);

-- Add comment explaining the resource column
COMMENT ON COLUMN star.resource IS 'Fixed natural resource abundance (0.0-100.0) - unchangeable once set';
