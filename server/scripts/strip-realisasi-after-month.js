#!/usr/bin/env node
/**
 * Hapus realisasi (monthly_data) KPI pegawai untuk bulan SETELAH bulan cutoff,
 * lalu hitung ulang kolom actual dan agregasi Master KPI. Target bulanan tidak diubah.
 * Tabel kpis dibackup ke kpis_backup_realisasi_<timestamp> sebelum update.
 *
 * Usage (di server):
 *   node scripts/strip-realisasi-after-month.js --cutoff=Ags --dry-run
 *   node scripts/strip-realisasi-after-month.js --cutoff=Ags
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const db = require('../db');
const { aggregateMasterFromChildren } = require('../lib/kpi-master');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
const DRY = process.argv.includes('--dry-run');
const cutoffArg = (process.argv.find((a) => a.startsWith('--cutoff=')) || '').slice('--cutoff='.length);
const cutoffIdx = MONTHS.indexOf(cutoffArg);
if (cutoffIdx < 0) {
  console.error(`--cutoff wajib salah satu dari: ${MONTHS.join(', ')}`);
  process.exit(1);
}
const dropMonths = MONTHS.slice(cutoffIdx + 1);

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function parseJson(v) {
  if (v == null || v === '') return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return {}; }
}

async function main() {
  console.log(`Mode: ${DRY ? 'DRY-RUN' : 'WRITE'} | cutoff: ${cutoffArg} | hapus realisasi: ${dropMonths.join(', ') || '-'}`);
  const [rows] = await db.query(
    "SELECT id, kpi_code, monthly_data, actual FROM kpis WHERE COALESCE(unit_type, '') = 'pegawai'"
  );

  const updates = [];
  for (const row of rows) {
    const md = parseJson(row.monthly_data);
    const removed = dropMonths.filter((m) => md[m] !== undefined);
    if (!removed.length) continue;
    removed.forEach((m) => delete md[m]);
    const filled = MONTHS.filter((m) => md[m] !== undefined && md[m] !== '' && Number.isFinite(Number(md[m])));
    const actual = filled.length ? Math.round(Number(md[filled[filled.length - 1]]) * 100) / 100 : 0;
    updates.push({ id: row.id, code: row.kpi_code, md, actual, removed: removed.length });
  }

  console.log(`KPI pegawai: ${rows.length} | akan diubah: ${updates.length} | nilai bulan dihapus: ${updates.reduce((s, u) => s + u.removed, 0)}`);
  if (DRY || !updates.length) {
    await db.end();
    return;
  }

  const backupTable = `kpis_backup_realisasi_${stamp()}`;
  await db.query(`CREATE TABLE \`${backupTable}\` AS SELECT * FROM kpis`);
  console.log(`Backup: ${backupTable}`);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const u of updates) {
      await conn.query('UPDATE kpis SET monthly_data = ?, actual = ? WHERE id = ?', [JSON.stringify(u.md), u.actual, u.id]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  console.log(`Diupdate: ${updates.length}`);

  const codes = [...new Set(updates.map((u) => u.code).filter(Boolean))];
  for (const code of codes) await aggregateMasterFromChildren(db, code);
  console.log(`Master KPI diagregasi ulang: ${codes.length}`);
  console.log(`Rollback: UPDATE kpis k JOIN \`${backupTable}\` b ON b.id = k.id SET k.monthly_data = b.monthly_data, k.actual = b.actual;`);
  await db.end();
}

main().catch(async (err) => {
  console.error('ERROR:', err.message);
  try { await db.end(); } catch { /* ignore */ }
  process.exit(1);
});
