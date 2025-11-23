-- Orders by type/final for resolution
CREATE INDEX IF NOT EXISTS idx_orders_turn_type
  ON order_submission (game_id, turn_id, order_type, is_final);

-- Ships by status (active/disabled)
CREATE INDEX IF NOT EXISTS idx_ships_status
  ON ship (game_id, status);

-- Star recent updates
CREATE INDEX IF NOT EXISTS idx_stars_updated
  ON star_state (game_id, updated_at DESC);

-- Events helpers
CREATE INDEX IF NOT EXISTS idx_events_kind
  ON turn_resolution_event (game_id, turn_id, kind);
CREATE INDEX IF NOT EXISTS idx_events_seq
  ON turn_resolution_event (game_id, turn_id, seq DESC);
