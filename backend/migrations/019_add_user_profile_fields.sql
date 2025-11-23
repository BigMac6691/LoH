-- Migration 019: Add bio and text_message_contact fields to app_user table
-- These fields allow users to add profile information

-- Add bio field (text message/bio, no specific limit but reasonable default)
ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add text_message_contact field (limited to 1 KB = 1024 characters)
ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS text_message_contact TEXT CHECK (char_length(text_message_contact) <= 1024);

-- Add comments
COMMENT ON COLUMN app_user.bio IS 'User bio/message, free-form text';
COMMENT ON COLUMN app_user.text_message_contact IS 'Text message contact information, maximum 1024 characters (1 KB)';

