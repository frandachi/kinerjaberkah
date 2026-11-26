-- Buka input realisasi & target untuk semua user
-- Hapus kunci bulan hasil import; buka KPI yang is_locked
UPDATE kpis
SET monthly_data_locked = NULL,
    is_locked = 0
WHERE monthly_data_locked IS NOT NULL
   OR is_locked = 1
   OR status = 'Approved';

-- KPI Approved tetap bisa diisi realisasi/target; status dibiarkan
-- (endpoint realisasi tidak memblokir Approved)
