-- 007: Unit scorecard scoring via rumus (bukan tempelan Average Index)
-- Applied on prod 2026-11-22 / verified 2026-11-23
--
-- 1) Perluas presisi manual_indeks (fraksi Average Index / override individu)
ALTER TABLE kpis
  MODIFY COLUMN manual_indeks DECIMAL(10,6) NULL;

-- 2) Scorecard unit: kosongkan manual_indeks agar skor dihitung dari realisasi + polaritas
--    (KPI Individu non-unit tidak diubah di sini)
UPDATE kpis
SET manual_indeks = NULL
WHERE (
    unit_type IN ('kck', 'kc', 'kcp', 'kk')
    OR pic IN ('from-nilai-kantor-cabang', 'from-individu-pemimpin')
  )
  AND manual_indeks IS NOT NULL;

-- Catatan data (sudah dijalankan di prod, tidak diulang otomatis):
-- - Hapus baris sync kosong id LIKE 'kpi_nkc_sync_%' tanpa monthly_data/target
-- - Normalisasi rumus NPL (skala ×100) ada di server/lib/kpi-scoring.js + assets/kpi-scoring-Zero03.js
-- - Bobot KPI ekstra di luar 13 scorecard Excel diset 0 pada unit terkait
