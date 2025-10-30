-- Migration 010: Rename turn_resolution_event to turn_event and add player_id column
-- This allows players to see only events related to them

-- Step 1: Add player_id column to the existing table
ALTER TABLE turn_resolution_event ADD COLUMN player_id UUID REFERENCES game_player(id) ON DELETE CASCADE;

-- Step 2: Add index for player-based queries
CREATE INDEX IF NOT EXISTS idx_turn_event_player 
  ON turn_resolution_event (game_id, turn_id, player_id);

-- Step 3: Rename the table
ALTER TABLE turn_resolution_event RENAME TO turn_event;

-- Step 4: Rename the unique constraint
ALTER TABLE turn_event DROP CONSTRAINT IF EXISTS turn_resolution_event_turn_id_seq_key;
ALTER TABLE turn_event ADD CONSTRAINT turn_event_turn_id_seq_key UNIQUE (turn_id, seq);

-- Step 5: Rename the GIN index
DROP INDEX IF EXISTS idx_tre_details_gin;
CREATE INDEX IF NOT EXISTS idx_turn_event_details_gin
  ON turn_event USING GIN (details);

-- Step 6: Rename other indexes
DROP INDEX IF EXISTS idx_events_kind;
DROP INDEX IF EXISTS idx_events_seq;

CREATE INDEX IF NOT EXISTS idx_turn_event_kind
  ON turn_event (game_id, turn_id, kind);
CREATE INDEX IF NOT EXISTS idx_turn_event_seq
  ON turn_event (game_id, turn_id, seq DESC);

-- Step 7: Add comment
COMMENT ON TABLE turn_event IS 'Turn events - player-specific events that occur during turn resolution';
