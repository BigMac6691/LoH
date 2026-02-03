-- Migration 027: Update game substatus allowed values

ALTER TABLE game
DROP CONSTRAINT IF EXISTS game_substatus_check;

ALTER TABLE game
ADD CONSTRAINT game_substatus_check
CHECK (substatus IS NULL OR substatus IN ('map_generated', 'players_placed', 'turn_created'));

COMMENT ON COLUMN game.substatus IS 'Game substatus: map_generated (map created), players_placed (players placed on map), turn_created (initial turn created). Only set when status is "creating".';
