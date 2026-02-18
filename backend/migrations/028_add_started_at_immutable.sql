-- Migration 028: Prevent started_at updates once set

CREATE OR REPLACE FUNCTION prevent_started_at_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.started_at IS NOT NULL AND NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    RAISE EXCEPTION 'started_at is immutable once set';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_game_started_at_update ON game;
CREATE TRIGGER prevent_game_started_at_update
  BEFORE UPDATE ON game
  FOR EACH ROW
  EXECUTE FUNCTION prevent_started_at_update();
