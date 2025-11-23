-- Authentication and security tables

-- Add email_verified field to app_user
ALTER TABLE app_user 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- Auth tokens (for JWT refresh tokens and session management)
CREATE TABLE IF NOT EXISTS auth_token (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL, -- Hashed JWT refresh token
  token_type TEXT NOT NULL DEFAULT 'refresh', -- 'refresh' or 'access'
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  revoked BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_auth_token_user ON auth_token(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_token_hash ON auth_token(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_token_expires ON auth_token(expires_at);

-- Account lockout tracking (temporary lockouts after failed attempts)
CREATE TABLE IF NOT EXISTS account_lock (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES app_user(id) ON DELETE CASCADE,
  email TEXT NOT NULL, -- Store email for cases where user_id might not exist yet
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ, -- NULL if not locked, timestamp when lock expires
  last_attempt_at TIMESTAMPTZ,
  last_attempt_ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_lock_user ON account_lock(user_id);
CREATE INDEX IF NOT EXISTS idx_account_lock_email ON account_lock(email);
CREATE INDEX IF NOT EXISTS idx_account_lock_locked ON account_lock(locked_until) WHERE locked_until IS NOT NULL;

-- Email verification tokens
CREATE TABLE IF NOT EXISTS email_verification (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_token ON email_verification(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_expires ON email_verification(expires_at);

-- Password recovery tokens
CREATE TABLE IF NOT EXISTS password_recovery_token (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ, -- NULL if not used, timestamp when password was reset
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_password_recovery_user ON password_recovery_token(user_id);
CREATE INDEX IF NOT EXISTS idx_password_recovery_token ON password_recovery_token(token);
CREATE INDEX IF NOT EXISTS idx_password_recovery_expires ON password_recovery_token(expires_at);

