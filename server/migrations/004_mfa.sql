-- MFA / TOTP columns (aman dijalankan ulang)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;
