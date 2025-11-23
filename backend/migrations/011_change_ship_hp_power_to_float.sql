-- Migration 011: Change ship hp and power columns from INT to REAL (float)
-- This allows fractional HP values after combat damage calculations

-- Change hp column to REAL
ALTER TABLE ship ALTER COLUMN hp TYPE REAL USING hp::REAL;

-- Change power column to REAL
ALTER TABLE ship ALTER COLUMN power TYPE REAL USING power::REAL;

-- Add comment explaining the change
COMMENT ON COLUMN ship.hp IS 'Hit points (float to support fractional damage)';
COMMENT ON COLUMN ship.power IS 'Attack power (float for combat calculations)';

