-- KUMPULAN INDEX DATABASE UNTUK OPTIMASI PERFORMA
-- Jalankan perintah ini di database MySQL Anda (misal via phpMyAdmin, DBeaver, atau console MySQL)
-- Index ini akan mempercepat pencarian data dan load halaman saat data sudah ribuan.

-- 1. Index untuk tabel Users
ALTER TABLE users ADD INDEX idx_username (username);
ALTER TABLE users ADD INDEX idx_npp (npp);
ALTER TABLE users ADD INDEX idx_role (role);

-- 2. Index untuk tabel Pegawai
-- Mempercepat pencarian di Data Pegawai
ALTER TABLE pegawai ADD INDEX idx_pegawai_npp (npp);
ALTER TABLE pegawai ADD INDEX idx_pegawai_jabatan (jabatan);
ALTER TABLE pegawai ADD INDEX idx_pegawai_unit (unit_name);

-- 3. Index untuk tabel KPIs
-- Mempercepat filter KPI berdasarkan jabatan dan unit (terutama untuk login dengan Role User biasa)
ALTER TABLE kpis ADD INDEX idx_kpi_jabatan_unit (jabatan, unit_name);
ALTER TABLE kpis ADD INDEX idx_kpi_perspective (perspective);

-- 4. Index untuk Password History
-- Mempercepat validasi saat User mengganti password (cek 5 password terakhir)
ALTER TABLE password_history ADD INDEX idx_pwd_history_user (user_id, created_at);

-- 5. Index untuk Audit Logs
-- Mempercepat pencarian log history jika nantinya sangat besar
ALTER TABLE audit_logs ADD INDEX idx_audit_user (user_id);
ALTER TABLE audit_logs ADD INDEX idx_audit_action (action);
ALTER TABLE audit_logs ADD INDEX idx_audit_created_at (created_at);
