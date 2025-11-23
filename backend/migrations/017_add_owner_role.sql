-- Migration 017: Add 'owner' role and enforce single owner constraint
-- The owner role is special: only one user can ever have this role, and they can do everything

-- Step 1: Drop existing constraint if it exists (must do this first to allow UPDATE)
DO $$
BEGIN
  -- Check if there's an existing constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_app_user_role' 
    AND conrelid = 'app_user'::regclass
  ) THEN
    ALTER TABLE app_user DROP CONSTRAINT chk_app_user_role;
  END IF;
END $$;

-- Step 2: Update any invalid role values to 'player' (safety measure)
-- This ensures all existing rows comply with the new constraint
-- Now safe to do because we've dropped the old constraint
UPDATE app_user
SET role = 'player'
WHERE role IS NULL OR role NOT IN ('player', 'sponsor', 'admin', 'owner');

-- Step 3: Add CHECK constraint for valid roles (player, sponsor, admin, owner)
-- All existing rows now comply with this constraint
ALTER TABLE app_user
ADD CONSTRAINT chk_app_user_role 
CHECK (role IN ('player', 'sponsor', 'admin', 'owner'));

-- Create a unique partial index to enforce only one owner exists at a time
-- This creates a unique constraint only where role = 'owner'
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_user_single_owner 
ON app_user (role) 
WHERE role = 'owner';

-- Add comment
COMMENT ON COLUMN app_user.role IS 'User role: player (basic), sponsor (can create games), admin (full access), owner (only one exists, full access)';

