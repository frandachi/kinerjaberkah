/**
 * Import Monitoring KPI Divisi Penyelamatan Kredit (format Juli 2026).
 *
 * Mapping jabatan via NPP → master pegawai (unit Divisi Penyelamatan Kredit).
 *
 * Usage:
 *   node import-kpi-divisi-penyelamatan.js "/path/to/Monitoring....xlsx"
 *   node import-kpi-divisi-penyelamatan.js "/path/to/file.xlsx" --dry-run
 */
const crypto = require('crypto');
const path = require('path');
const XLSX = require('xlsx');
const db = require('./db');

const UNIT_NAME = 'Divisi Penyelamatan Kredit';
const UNIT_TYPE = 'divisi';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

function buildLockedMonthsFromData(monthlyData) {
  if (!monthlyData || typeof monthlyData !== 'object') return [];
  return MONTHS.filter((m) => {
    const val = monthlyData[m];
    return val !== undefined && val !== null && val !== '' && Number(val) !== 0;
  });
}

const filePath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!filePath) {
  console.error('Usage: node import-kpi-divisi-penyelamatan.js <xlsx> [--dry-run]');
  process.exit(1);
}

function normalizePerspective(perspective) {
  const v = (perspective || '').toString().trim().toLowerCase();
  if (v.includes('financial') || v.includes('finansial')) return 'financial';
  if (v.includes('customer')) return 'customer';
  if (v.includes('internal') || v.includes('bisnis') || v.includes('proses')) return 'internal_process';
  if (v.includes('learning') || v.includes('growth') || v.includes('people')) return 'learning_growth';
  return 'financial';
}

function normalizeUnit(raw) {
  const v = (raw || '').toString().trim().toLowerCase();
  if (v.includes('juta') || v.includes('rupiah')) return 'currency';
  if (v.includes('persen') || v === '%' || v.includes('percent')) return 'percentage';
  if (v.includes('indeks') || v.includes('skor')) return 'score';
  if (v.includes('jumlah') || v.includes('angka')) return 'number';
  return 'number';
}

function inferPolarity(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('npl') || n.includes('npf') || n.includes('cost')) return 'minimize';
  return 'maximize';
}

function parseNumericValue(raw, unit) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    if (Number.isNaN(raw)) return null;
    if (unit === 'percentage' && Math.abs(raw) <= 1.5) return Math.round(raw * 10000) / 100;
    return raw;
  }
  const text = String(raw).trim();
  const match = text.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const num = parseFloat(match[0].replace(',', '.'));
  if (Number.isNaN(num)) return null;
  if (unit === 'percentage' && Math.abs(num) <= 1.5) return Math.round(num * 10000) / 100;
  return num;
}

function cleanName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim();
}

function normalizeNpp(npp) {
  return String(npp || '').trim().replace(/^CEK MPP-/i, '');
}

/**
 * Format Monitoring:
 * A Jabatan, B Nama, C NPP, D Perspektif, E Indikator, F Ukuran, G Bobot, H Target Tahunan
 * I/J Jan Realisasi/Target ... U/V Jul Realisasi/Target
 */
function parseMonitoringExcel(absPath) {
  const wb = XLSX.readFile(absPath);
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });

  let curJabatan = '';
  let curNama = '';
  let curNpp = '';
  let curPerspective = '';
  const groups = new Map(); // key = npp

  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.some((c) => c !== null && c !== '')) continue;

    if (row[0]) {
      curJabatan = String(row[0]).trim();
      curNama = row[1] != null ? String(row[1]).trim() : curNama;
      curNpp = row[2] != null ? normalizeNpp(row[2]) : curNpp;
    }
    if (row[3]) curPerspective = String(row[3]).trim();

    const name = cleanName(row[4]);
    if (!name || !curNpp) continue;

    const unit = normalizeUnit(row[5]);
    const weight = Number(row[6]) || 0;
    const annualTarget = parseNumericValue(row[7], unit);

    const monthly_data = {};
    const monthly_target = {};
    for (let mi = 0; mi < 7; mi++) {
      const base = 8 + mi * 2;
      const real = parseNumericValue(row[base], unit);
      const tgt = parseNumericValue(row[base + 1], unit);
      const month = MONTHS[mi];
      if (real !== null) monthly_data[month] = real;
      if (tgt !== null) monthly_target[month] = tgt;
    }

    if (!groups.has(curNpp)) {
      groups.set(curNpp, {
        excelJabatan: curJabatan,
        nama: curNama,
        npp: curNpp,
        kpis: [],
      });
    }
    groups.get(curNpp).kpis.push({
      name,
      perspective: normalizePerspective(curPerspective),
      unit,
      weight,
      target: annualTarget ?? 0,
      polarity: inferPolarity(name),
      monthly_data,
      monthly_target,
    });
  }

  return { sheetName, groups: [...groups.values()] };
}

async function resolvePegawai(npp, nama) {
  const nppNorm = normalizeNpp(npp);
  const [byNpp] = await db.query(
    `SELECT name, jabatan, npp, unit_name FROM pegawai
     WHERE unit_name = ? AND REPLACE(npp, 'CEK MPP-', '') = ?
     ORDER BY name LIMIT 5`,
    [UNIT_NAME, nppNorm]
  );
  if (byNpp.length === 1) return byNpp[0];
  if (byNpp.length > 1) {
    const byName = byNpp.find((p) => String(p.name).toLowerCase() === String(nama || '').toLowerCase());
    return byName || byNpp[0];
  }

  const [byName] = await db.query(
    `SELECT name, jabatan, npp, unit_name FROM pegawai
     WHERE unit_name = ? AND LOWER(name) = LOWER(?)
     LIMIT 1`,
    [UNIT_NAME, nama]
  );
  return byName[0] || null;
}

async function importForJabatan(jabatan, kpis) {
  const [deleted] = await db.query(
    'DELETE FROM kpis WHERE jabatan = ? AND unit_name = ?',
    [jabatan, UNIT_NAME]
  );

  const insertValues = kpis.map((kpi, index) => {
    const lockedMonths = buildLockedMonthsFromData(kpi.monthly_data);
    return [
      `kpi_${Date.now()}_${index}_${crypto.randomBytes(4).toString('hex')}`,
      kpi.name,
      kpi.perspective,
      kpi.unit,
      kpi.polarity,
      kpi.target,
      0,
      kpi.weight,
      UNIT_NAME,
      jabatan,
      null,
      null,
      JSON.stringify(kpi.monthly_data || {}),
      JSON.stringify(kpi.monthly_target || {}),
      UNIT_TYPE,
      null,
      'Draft',
      null,
      null,
      null,
      index,
      0,
      JSON.stringify(lockedMonths),
    ];
  });

  await db.query(
    `INSERT INTO kpis (
      id, name, perspective, unit, polarity, target, actual, weight,
      unit_name, jabatan, strategy_id, manual_indeks, monthly_data, monthly_target,
      unit_type, parent_kpi_id, status, description, formula, objective, sort_order, is_locked,
      monthly_data_locked
    ) VALUES ?`,
    [insertValues]
  );

  return { deleted: deleted.affectedRows, inserted: insertValues.length };
}

async function main() {
  const abs = path.resolve(filePath);
  const parsed = parseMonitoringExcel(abs);

  console.log(`File: ${path.basename(abs)}`);
  console.log(`Sheet: ${parsed.sheetName}`);
  console.log(`Grup (by NPP): ${parsed.groups.length}`);
  console.log(`Unit target: ${UNIT_NAME}`);
  if (dryRun) console.log('*** DRY RUN — tidak menulis DB ***\n');

  let totalDeleted = 0;
  let totalInserted = 0;

  for (const group of parsed.groups) {
    const peg = await resolvePegawai(group.npp, group.nama);
    const bobot = group.kpis.reduce((s, k) => s + (k.weight || 0), 0);
    console.log(`\n===== ${group.excelJabatan} | ${group.nama} | ${group.npp} =====`);
    console.log(`KPI: ${group.kpis.length}, bobot: ${bobot}%`);

    if (!peg) {
      console.error(`  ✗ Pegawai tidak ditemukan di unit ${UNIT_NAME}`);
      continue;
    }
    console.log(`  → DB jabatan: ${peg.jabatan}`);

    group.kpis.forEach((k, i) => {
      const months = Object.keys(k.monthly_data).join(',');
      console.log(`  ${i + 1}. [${k.perspective}] ${k.name} | ${k.unit} | w=${k.weight} | tgt=${k.target} | realisasi: ${months || '-'}`);
    });

    if (dryRun) continue;

    const result = await importForJabatan(peg.jabatan, group.kpis);
    totalDeleted += result.deleted;
    totalInserted += result.inserted;
    console.log(`  ✓ hapus ${result.deleted}, insert ${result.inserted}`);
  }

  console.log(`\n===== TOTAL =====`);
  console.log(`Deleted: ${totalDeleted}, Inserted: ${totalInserted}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
