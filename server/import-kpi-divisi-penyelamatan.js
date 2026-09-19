/**
 * Import Monitoring KPI Individu — Divisi Penyelamatan Kredit
 * Format: Jabatan | Nama | NPP | Perspektif | Indikator | Ukuran | Bobot | Target Tahunan
 *         + Januari..Juli (Realisasi, Target) per bulan
 *
 * Usage:
 *   node import-kpi-divisi-penyelamatan.js "../Monitoring KPI Divisi Penyelamatan Kredit Juli 2026_ALL_27082026-1.xlsx"
 *   node import-kpi-divisi-penyelamatan.js "....xlsx" --dry-run
 */
const crypto = require('crypto');
const path = require('path');
const XLSX = require('xlsx');

require('dotenv').config({ path: path.join(__dirname, '.env.production'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true, quiet: true });
const db = require('./db');

const UNIT_NAME = 'Divisi Penyelamatan Kredit';
const UNIT_TYPE = 'divisi';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

const filePath =
  process.argv[2] ||
  path.join(__dirname, '..', 'Monitoring KPI Divisi Penyelamatan Kredit Juli 2026_ALL_27082026-1.xlsx');
const dryRun = process.argv.includes('--dry-run');

function buildLockedMonthsFromData(monthlyData) {
  if (!monthlyData || typeof monthlyData !== 'object') return [];
  return MONTHS.filter((m) => {
    const val = monthlyData[m];
    return val !== undefined && val !== null && val !== '' && !(typeof val === 'number' && Number.isNaN(val));
  });
}

function normalizePerspective(perspective) {
  const v = (perspective || '').toString().trim().toLowerCase();
  if (v.includes('financial') || v.includes('finansial')) return 'financial';
  if (v.includes('customer') || v.includes('pelanggan')) return 'customer';
  if (v.includes('internal') || v.includes('bisnis') || v.includes('proses')) return 'internal_process';
  if (v.includes('learning') || v.includes('growth') || v.includes('people')) return 'learning_growth';
  return 'financial';
}

function normalizeUnit(raw) {
  const v = (raw || '').toString().trim().toLowerCase();
  if (v.includes('juta') || v.includes('rupiah')) return 'Juta Rupiah';
  if (v.includes('persen') || v === '%' || v.includes('percent')) return 'Percent %';
  if (v.includes('indeks') || v.includes('skor')) return 'Indeks';
  if (v.includes('jumlah') || v.includes('angka') || v.includes('bilangan')) return 'Bilangan';
  return raw ? String(raw).trim() : 'Bilangan';
}

function isPercentUnit(unit) {
  const u = String(unit || '').toLowerCase();
  return u.includes('percent') || u.includes('%') || u.includes('persen');
}

function inferPolarity(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('npl') || n.includes('npf') || n.includes('cost') || n.includes('beban') || n.includes('tunggakan')) {
    return 'minimize';
  }
  return 'maximize';
}

function roundNum(n) {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n * 10000) / 10000;
}

function parseNumericValue(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    if (Number.isNaN(raw)) return null;
    return roundNum(raw);
  }
  let text = String(raw).trim();
  if (!text || text === '-' || text.toLowerCase() === 'n/a') return null;
  // ">95 %" / "≥ 95%"
  text = text.replace(/^[>≥<≤]\s*/u, '');
  const neg = /^\(.*\)$/.test(text);
  text = text.replace(/[()]/g, '').replace(/%/g, '').replace(/\s/g, '').replace(/,/g, '');
  const num = parseFloat(text);
  if (Number.isNaN(num)) return null;
  return roundNum(neg ? -num : num);
}

function parseWeight(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') {
    if (Number.isNaN(raw)) return 0;
    return roundNum(Math.abs(raw) <= 1.5 ? raw * 100 : raw) || 0;
  }
  const n = parseNumericValue(raw);
  if (n == null) return 0;
  return roundNum(Math.abs(n) <= 1.5 ? n * 100 : n) || 0;
}

function scalePercentIfFraction(val, unit) {
  if (val == null || !isPercentUnit(unit)) return val;
  // File Penyelamatan menyimpan % sebagai fraksi (0.0277 = 2.77%, 1 = 100%)
  if (Math.abs(val) <= 1.5) return roundNum(val * 100);
  return val;
}

function cleanName(name) {
  return String(name || '')
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clipName(name, max = 255) {
  const s = cleanName(name);
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

function normalizeNpp(npp) {
  return String(npp || '')
    .trim()
    .replace(/^CEK MPP-/i, '');
}

function normalizeJabatanExcel(j) {
  let s = cleanName(j);
  if (/^Pemimpin Divisi$/i.test(s)) return 'Pj.Pemimpin Divisi Penyelamatan Kredit';
  return s;
}

function isJunkKpiName(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return true;
  if (n.startsWith(':')) return true;
  if (n.includes('diisi sesuai') || n.includes('diisi dengan') || n.includes('format excel')) return true;
  return false;
}

function parseExcel(absPath) {
  const wb = XLSX.readFile(absPath, { cellDates: false });
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null, raw: true });

  let curJabatan = '';
  let curNama = '';
  let curNpp = '';
  let curPerspective = '';
  const groups = new Map();

  // Deteksi jumlah pasangan bulan dari header baris 1
  const header = rows[1] || [];
  let monthPairs = 0;
  for (let c = 8; c < header.length; c += 2) {
    if (header[c] != null && String(header[c]).trim()) monthPairs += 1;
    else if (rows[3] && (rows[3][c] != null || rows[3][c + 1] != null)) monthPairs += 1;
  }
  if (monthPairs < 1) monthPairs = 7;
  monthPairs = Math.min(monthPairs, 12);

  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.some((c) => c !== null && c !== '')) continue;

    if (row[0]) {
      curJabatan = normalizeJabatanExcel(row[0]);
      curNama = row[1] != null ? cleanName(row[1]) : curNama;
      curNpp = row[2] != null ? normalizeNpp(row[2]) : curNpp;
    }
    if (row[3]) curPerspective = String(row[3]).trim();

    const name = cleanName(row[4]);
    if (!name || !curNpp || isJunkKpiName(name)) continue;

    const unit = normalizeUnit(row[5]);
    const weight = parseWeight(row[6]);
    let annualTarget = parseNumericValue(row[7]);
    annualTarget = scalePercentIfFraction(annualTarget, unit);

    const monthly_data = {};
    const monthly_target = {};
    for (let mi = 0; mi < monthPairs; mi++) {
      const base = 8 + mi * 2;
      let real = parseNumericValue(row[base]);
      let tgt = parseNumericValue(row[base + 1]);
      real = scalePercentIfFraction(real, unit);
      tgt = scalePercentIfFraction(tgt, unit);
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

  return { sheetName, groups: [...groups.values()], monthPairs };
}

async function resolvePegawai(npp, nama) {
  const nppNorm = normalizeNpp(npp);
  const [byNpp] = await db.query(
    `SELECT name, jabatan, npp, unit_name FROM pegawai
     WHERE REPLACE(REPLACE(npp, 'CEK MPP-', ''), ' ', '') = ?
     ORDER BY (unit_name = ?) DESC, name
     LIMIT 5`,
    [nppNorm, UNIT_NAME]
  );
  if (byNpp.length) {
    const inUnit = byNpp.filter((p) => String(p.unit_name || '').toLowerCase().includes('penyelamatan'));
    if (inUnit.length) {
      const byName = inUnit.find((p) => String(p.name).toLowerCase() === String(nama || '').toLowerCase());
      return { ...(byName || inUnit[0]), _forceUnit: false };
    }
    const byName = byNpp.find((p) => String(p.name).toLowerCase() === String(nama || '').toLowerCase());
    return { ...(byName || byNpp[0]), _forceUnit: true };
  }

  const [byName] = await db.query(
    `SELECT name, jabatan, npp, unit_name FROM pegawai
     WHERE unit_name = ? AND LOWER(TRIM(name)) = LOWER(?)
     LIMIT 1`,
    [UNIT_NAME, nama]
  );
  if (byName[0]) return { ...byName[0], _forceUnit: false };

  const [byUser] = await db.query(
    `SELECT name, jabatan, npp, unit_name FROM users
     WHERE unit_name = ? AND (
       REPLACE(REPLACE(COALESCE(npp,''), 'CEK MPP-', ''), ' ', '') = ?
       OR LOWER(TRIM(name)) = LOWER(?)
     )
     LIMIT 1`,
    [UNIT_NAME, nppNorm, nama]
  );
  return byUser[0] ? { ...byUser[0], _forceUnit: false } : null;
}

async function syncJabatan(peg, jabatan) {
  if (!peg || !jabatan) return;
  const needUnit = peg._forceUnit || String(peg.unit_name || '') !== UNIT_NAME;
  const needJab = String(peg.jabatan || '').trim() !== jabatan;
  if (!needUnit && !needJab) return;
  await db.query(`UPDATE pegawai SET jabatan = ?, unit_name = ? WHERE npp = ? OR REPLACE(npp,'CEK MPP-','') = ?`, [
    jabatan,
    UNIT_NAME,
    peg.npp,
    normalizeNpp(peg.npp),
  ]);
  await db.query(`UPDATE users SET jabatan = ?, unit_name = ? WHERE npp = ? OR REPLACE(COALESCE(npp,''),'CEK MPP-','') = ?`, [
    jabatan,
    UNIT_NAME,
    peg.npp,
    normalizeNpp(peg.npp),
  ]);
  peg.jabatan = jabatan;
  peg.unit_name = UNIT_NAME;
}

async function importForJabatan(jabatan, kpis) {
  const [deleted] = await db.query('DELETE FROM kpis WHERE jabatan = ? AND unit_name = ?', [jabatan, UNIT_NAME]);

  const insertValues = kpis.map((kpi, index) => {
    const lockedMonths = buildLockedMonthsFromData(kpi.monthly_data);
    const lastReal = MONTHS.map((m) => kpi.monthly_data[m]).filter((v) => v != null).pop();
    const fullName = cleanName(kpi.name);
    const shortName = clipName(fullName, 255);
    return [
      `kpi_${Date.now()}_${index}_${crypto.randomBytes(4).toString('hex')}`,
      shortName,
      kpi.perspective,
      kpi.unit,
      kpi.polarity,
      kpi.target,
      lastReal ?? 0,
      kpi.weight,
      UNIT_NAME,
      clipName(jabatan, 255),
      null,
      null,
      JSON.stringify(kpi.monthly_data || {}),
      JSON.stringify(kpi.monthly_target || {}),
      UNIT_TYPE,
      null,
      'Draft',
      fullName.length > 255 ? fullName : null,
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
  const parsed = parseExcel(abs);

  console.log(`File: ${path.basename(abs)}`);
  console.log(`Sheet: ${parsed.sheetName}`);
  console.log(`Grup (by NPP): ${parsed.groups.length}`);
  console.log(`Bulan terisi: ${parsed.monthPairs} (${MONTHS.slice(0, parsed.monthPairs).join(',')})`);
  console.log(`Unit target: ${UNIT_NAME} (${UNIT_TYPE})`);
  if (dryRun) console.log('*** DRY RUN — tidak menulis DB ***\n');
  else {
    const [cleared] = await db.query('DELETE FROM kpis WHERE unit_name = ?', [UNIT_NAME]);
    console.log(`Clear KPI lama unit ${UNIT_NAME}: ${cleared.affectedRows} baris\n`);
  }

  const resolved = [];
  for (const group of parsed.groups) {
    const peg = await resolvePegawai(group.npp, group.nama);
    resolved.push({ group, peg });
  }

  const byJabatan = new Map();
  for (const item of resolved) {
    if (!item.peg) continue;
    const base = String(item.group.excelJabatan || item.peg.jabatan || '').trim();
    item.baseJabatan = base;
    if (!byJabatan.has(base)) byJabatan.set(base, []);
    byJabatan.get(base).push(item);
  }

  const jabatanFor = new Map();
  for (const [base, items] of byJabatan.entries()) {
    if (items.length === 1) {
      jabatanFor.set(items[0].group.npp, base);
      continue;
    }
    for (const it of items) {
      const person = it.peg.name || it.group.nama;
      jabatanFor.set(it.group.npp, `${base} (${person})`);
    }
  }

  let totalDeleted = 0;
  let totalInserted = 0;
  let skipped = 0;
  const importedJabatan = new Set();

  for (const { group, peg } of resolved) {
    const bobot = group.kpis.reduce((s, k) => s + (k.weight || 0), 0);
    console.log(`\n===== ${group.excelJabatan} | ${group.nama} | ${group.npp} =====`);
    console.log(`KPI: ${group.kpis.length}, bobot: ${bobot}%`);

    if (!peg) {
      console.error(`  ✗ Pegawai/user tidak ditemukan (NPP/nama)`);
      skipped += 1;
      continue;
    }

    const finalJabatan = jabatanFor.get(group.npp) || peg.jabatan;
    console.log(`  → DB: ${peg.name} | ${peg.jabatan} → KPI jabatan: ${finalJabatan}`);

    if (importedJabatan.has(finalJabatan)) {
      console.log(`  ↷ Lewati insert (jabatan ${finalJabatan} sudah diimpor)`);
      continue;
    }

    group.kpis.slice(0, 3).forEach((k, i) => {
      const months = Object.keys(k.monthly_data).join(',');
      console.log(
        `  ${i + 1}. [${k.perspective}] ${k.name} | ${k.unit} | w=${k.weight} | tgt=${k.target} | realisasi: ${months || '-'}`
      );
    });
    if (group.kpis.length > 3) console.log(`  ... +${group.kpis.length - 3} KPI lain`);

    if (dryRun) {
      importedJabatan.add(finalJabatan);
      continue;
    }

    await syncJabatan(peg, finalJabatan);
    const result = await importForJabatan(finalJabatan, group.kpis);
    importedJabatan.add(finalJabatan);
    totalDeleted += result.deleted;
    totalInserted += result.inserted;
    console.log(`  ✓ hapus ${result.deleted}, insert ${result.inserted}`);
  }

  console.log(`\n===== TOTAL =====`);
  console.log(`Deleted: ${totalDeleted}, Inserted: ${totalInserted}, Skipped (no pegawai): ${skipped}`);
  process.exit(skipped && !totalInserted ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
