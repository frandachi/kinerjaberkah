-- Wajibkan MFA untuk semua user.
-- JANGAN set totp_enabled = TRUE di sini: user yang belum scan authenticator
-- akan terkunci. Aktivasi dilakukan saat login pertama setelah migrasi ini.
--
-- Kompatibel MySQL yang tidak mendukung ADD COLUMN IF NOT EXISTS.
-- Aman dijalankan ulang: kolom yang sudah ada akan di-skip.

-- totp_secret
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'totp_secret'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE users ADD COLUMN totp_secret VARCHAR(255) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- totp_enabled
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'totp_enabled'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- mfa_enrolled_at
SET @exist := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'mfa_enrolled_at'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE users ADD COLUMN mfa_enrolled_at DATETIME NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- User lama tetap bisa login dengan password, lalu dipaksa enroll MFA.
-- Setelah enroll berhasil, totp_enabled = TRUE dan mfa_enrolled_at terisi.
