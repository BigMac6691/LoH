-- Migration 021: Add 'visitor' role and update email_verification to store original role
-- Visitors are unverified users with limited access. They are promoted to 'player' when email is verified.

-- Step 1: Drop existing constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_app_user_role' 
    AND conrelid = 'app_user'::regclass
  ) THEN
    ALTER TABLE app_user DROP CONSTRAINT chk_app_user_role;
  END IF;
END $$;

-- Step 2: Update any invalid role values to 'visitor' (safety measure)
UPDATE app_user
SET role = 'visitor'
WHERE role IS NULL OR role NOT IN ('visitor', 'player', 'sponsor', 'admin', 'owner');

-- Step 3: Add CHECK constraint for valid roles (visitor, player, sponsor, admin, owner)
ALTER TABLE app_user
ADD CONSTRAINT chk_app_user_role 
CHECK (role IN ('visitor', 'player', 'sponsor', 'admin', 'owner'));

-- Step 4: Add original_role column to email_verification table
-- This stores the user's role at the time verification was requested
-- Used to restore role when email is verified (for users who changed email)
ALTER TABLE email_verification
ADD COLUMN IF NOT EXISTS original_role TEXT;

-- Add comment
COMMENT ON COLUMN app_user.role IS 'User role: visitor (unverified, limited access), player (basic), sponsor (can create games), admin (full access), owner (only one exists, full access)';
COMMENT ON COLUMN email_verification.original_role IS 'User role at time verification was requested. Used to restore role when email is verified.';

