-- Migration 016: Add system_events table for system messages/events
-- This table stores system-wide messages and events that appear in the News and Events view

CREATE TABLE IF NOT EXISTS system_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  creator_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) <= 1024) -- Max 1KB (1024 characters)
);

-- Add index on created_at for efficient chronological queries
CREATE INDEX IF NOT EXISTS idx_system_event_created_at ON system_event(created_at DESC);

-- Add index on creator_id for filtering by creator
CREATE INDEX IF NOT EXISTS idx_system_event_creator_id ON system_event(creator_id);

-- Add comments
COMMENT ON TABLE system_event IS 'System-wide events and messages displayed in News and Events view';
COMMENT ON COLUMN system_event.created_at IS 'Timestamp when the system event was created';
COMMENT ON COLUMN system_event.creator_id IS 'User ID of the person who created this system event';
COMMENT ON COLUMN system_event.text IS 'Event message text, maximum 1024 characters (1KB)';

