-- Migration 004: Fix star and wormhole primary keys to use UUIDs
-- This prevents collisions when creating multiple games with the same seed

-- Step 1: Add new UUID columns to star table
ALTER TABLE star ADD COLUMN new_id UUID DEFAULT gen_random_uuid();
ALTER TABLE star ADD COLUMN star_id TEXT;

-- Step 2: Copy existing id to star_id
UPDATE star SET star_id = id;

-- Step 3: Drop old primary key and constraints (use CASCADE to handle dependencies)
ALTER TABLE star DROP CONSTRAINT IF EXISTS star_pkey CASCADE;
ALTER TABLE star DROP CONSTRAINT IF EXISTS star_game_id_key CASCADE;

-- Step 4: Set up new primary key and constraints
ALTER TABLE star ALTER COLUMN new_id SET NOT NULL;
ALTER TABLE star ALTER COLUMN star_id SET NOT NULL;
ALTER TABLE star ADD PRIMARY KEY (new_id);
ALTER TABLE star ADD CONSTRAINT star_game_star_id_unique UNIQUE (game_id, star_id);

-- Step 5: Drop old id column and rename new_id to id
ALTER TABLE star DROP COLUMN id;
ALTER TABLE star RENAME COLUMN new_id TO id;

-- Step 6: Add new UUID columns to wormhole table
ALTER TABLE wormhole ADD COLUMN new_id UUID DEFAULT gen_random_uuid();
ALTER TABLE wormhole ADD COLUMN wormhole_id TEXT;

-- Step 7: Copy existing id to wormhole_id
UPDATE wormhole SET wormhole_id = id;

-- Step 8: Drop old primary key and constraints (use CASCADE to handle dependencies)
ALTER TABLE wormhole DROP CONSTRAINT IF EXISTS wormhole_pkey CASCADE;
ALTER TABLE wormhole DROP CONSTRAINT IF EXISTS wormhole_game_star_a_id_star_b_id_key CASCADE;

-- Step 9: Set up new primary key and constraints
ALTER TABLE wormhole ALTER COLUMN new_id SET NOT NULL;
ALTER TABLE wormhole ALTER COLUMN wormhole_id SET NOT NULL;
ALTER TABLE wormhole ADD PRIMARY KEY (new_id);
ALTER TABLE wormhole ADD CONSTRAINT wormhole_game_wormhole_id_unique UNIQUE (game_id, wormhole_id);

-- Step 10: Drop old id column and rename new_id to id
ALTER TABLE wormhole DROP COLUMN id;
ALTER TABLE wormhole RENAME COLUMN new_id TO id;

-- Step 11: Update indexes
DROP INDEX IF EXISTS idx_star_game;
DROP INDEX IF EXISTS idx_wormhole_game;
CREATE INDEX idx_star_game ON star(game_id);
CREATE INDEX idx_wormhole_game ON wormhole(game_id);
CREATE INDEX idx_star_game_star_id ON star(game_id, star_id);
CREATE INDEX idx_wormhole_game_wormhole_id ON wormhole(game_id, wormhole_id);
