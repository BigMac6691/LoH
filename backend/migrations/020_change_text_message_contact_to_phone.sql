-- Migration 020: Change text_message_contact to 10-digit phone number
-- Update the field to store only 10-digit phone numbers

-- Drop the old check constraint
ALTER TABLE app_user
DROP CONSTRAINT IF EXISTS app_user_text_message_contact_check;

-- Add new check constraint for 10-digit phone number (digits only)
ALTER TABLE app_user
ADD CONSTRAINT app_user_text_message_contact_check
CHECK (text_message_contact IS NULL OR (char_length(text_message_contact) = 10 AND text_message_contact ~ '^[0-9]+$'));

-- Update comment
COMMENT ON COLUMN app_user.text_message_contact IS 'Text message contact phone number, exactly 10 digits';

