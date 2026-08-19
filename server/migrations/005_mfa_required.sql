-- Wajibkan MFA untuk semua user.
-- JANGAN set totp_enabled = TRUE di sini: user yang belum scan authenticator
-- akan terkunci. Aktivasi dilakukan saat login pertama setelah migrasi ini.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at DATETIME NULL;

-- User lama tetap bisa login dengan password, lalu dipaksa enroll MFA.
-- Setelah enroll berhasil, totp_enabled = TRUE dan mfa_enrolled_at terisi.
