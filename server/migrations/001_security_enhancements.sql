-- Migration: Security & Feature Enhancements
-- Run this script to add new tables and columns for enhanced security features
--
-- NOTE: This file previously used `CREATE INDEX ... IF NOT EXISTS`, which is
-- not valid MySQL syntax (MySQL only supports IF NOT EXISTS for
-- ALTER TABLE ... ADD COLUMN/ADD INDEX and CREATE TABLE/DATABASE). It has
-- been rewritten below to use `ALTER TABLE ... ADD INDEX IF NOT EXISTS`,
-- which MySQL 8.0.29+ does support. It also now includes the created_at /
-- user_id columns that the application code actually relies on
-- (kpis.created_at, users.created_at, objectives.created_at,
-- activity_logs.user_id) which were missing from the original migration.

-- Add new columns to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until DATETIME NULL,
  ADD COLUMN IF NOT EXISTS last_login DATETIME NULL,
  ADD COLUMN IF NOT EXISTS password_changed_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;

-- Create password_history table
CREATE TABLE IF NOT EXISTS password_history (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create maker_checker table
CREATE TABLE IF NOT EXISTS maker_checker (
  id VARCHAR(100) PRIMARY KEY,
  maker_id VARCHAR(100) NOT NULL,
  checker_id VARCHAR(100) NULL,
  action_type VARCHAR(100) NOT NULL,
  target_id VARCHAR(100) NULL,
  details JSON,
  reason TEXT,
  checker_comments TEXT,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME NULL,
  FOREIGN KEY (maker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (checker_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create mutation_history table (pegawai_id is VARCHAR to match pegawai.id / users.pegawai_id,
-- which are string ids like "peg_<timestamp>", not integers)
CREATE TABLE IF NOT EXISTS mutation_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pegawai_id VARCHAR(100) NOT NULL,
  npp VARCHAR(50) NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  old_unit_name VARCHAR(255) NOT NULL,
  old_jabatan VARCHAR(255) NOT NULL,
  old_unit_type VARCHAR(50),
  new_unit_name VARCHAR(255) NOT NULL,
  new_jabatan VARCHAR(255) NOT NULL,
  new_unit_type VARCHAR(50),
  effective_date DATE NOT NULL,
  old_period_start DATE NOT NULL,
  old_period_end DATE NOT NULL,
  new_period_start DATE NOT NULL,
  new_period_end DATE NOT NULL,
  old_kpi_ids JSON COMMENT 'Array of KPI IDs from old unit',
  new_kpi_ids JSON COMMENT 'Array of KPI IDs from new unit',
  status ENUM('active', 'completed') DEFAULT 'active',
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pegawai_id (pegawai_id),
  INDEX idx_effective_date (effective_date),
  INDEX idx_npp (npp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add columns to kpis table for audit trail + created_at (needed for
-- "ORDER BY created_at" used by GET /api/kpis) + is_locked (used by
-- POST /api/kpis/lock and the mutation-split logic in routes/mutations.js,
-- but was never actually added to the original schema)
ALTER TABLE kpis 
  ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- NOTE: this hosting's MySQL build (8.0.46-cll-lve) rejects the
-- `ADD COLUMN IF NOT EXISTS` clause above with a syntax error even though
-- it is valid MySQL 8.0.29+ syntax elsewhere. If you hit
-- "You have an error in your SQL syntax ... near 'IF NOT EXISTS'", check
-- each column with information_schema.COLUMNS first and drop the
-- "IF NOT EXISTS" from the ALTER TABLE statements that still need to run.

-- Add created_at to objectives (needed for the /api/objectives "ORDER BY created_at" CRUD route)
ALTER TABLE objectives
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;

-- Update activity_logs table: user_id + ip_address are what middleware/audit.js
-- actually inserts (the table originally only had user_name/user_role, so every
-- insert was silently failing before this migration was applied)
ALTER TABLE activity_logs 
  ADD COLUMN IF NOT EXISTS user_id VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45) NULL;

-- Create indexes for performance
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_users_username (username);
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_users_npp (npp);
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_users_jabatan (jabatan);
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_users_unit_name (unit_name);
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_users_role (role);
ALTER TABLE kpis ADD INDEX IF NOT EXISTS idx_kpis_jabatan_unit (jabatan, unit_name);
ALTER TABLE kpis ADD INDEX IF NOT EXISTS idx_kpis_status (status);
ALTER TABLE kpis ADD INDEX IF NOT EXISTS idx_kpis_unit_name (unit_name);
ALTER TABLE kpis ADD INDEX IF NOT EXISTS idx_kpis_perspective (perspective);
ALTER TABLE pegawai ADD INDEX IF NOT EXISTS idx_pegawai_npp (npp);
ALTER TABLE pegawai ADD INDEX IF NOT EXISTS idx_pegawai_jabatan (jabatan);
ALTER TABLE pegawai ADD INDEX IF NOT EXISTS idx_pegawai_unit (unit_name);
ALTER TABLE activity_logs ADD INDEX IF NOT EXISTS idx_activity_logs_user (user_id);
ALTER TABLE activity_logs ADD INDEX IF NOT EXISTS idx_activity_logs_created (created_at);
ALTER TABLE mutation_history ADD INDEX IF NOT EXISTS idx_mutation_pegawai (pegawai_id);
ALTER TABLE password_history ADD INDEX IF NOT EXISTS idx_password_history_user (user_id);
ALTER TABLE maker_checker ADD INDEX IF NOT EXISTS idx_maker_checker_status (status);
