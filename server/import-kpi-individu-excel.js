/**
 * Import KPI Individu from Excel — match pegawai by NPP or Nama.
 * Usage: node import-kpi-individu-excel.js [path-to-xlsx]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const xlsx = require('xlsx');

require('dotenv').config({ path: path.join(__dirname, '.env.production'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true, quiet: true });
const db = require('./db');

const ROOT = path.join(__dirname, '..');

function normText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s/%.-]/g, '');
}

function normName(value) {
  return normText(value);
}

function loadJsonTemplates() {
  const files = ['kpi_kc.json', 'kpi_kcp.json', 'kpi_kck.json', 'kpi_pelaksana.json'];
  const lookup = new Map();

  for (const file of files) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) continue;
    const templates = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const group of templates) {
      const jabatan = String(group.jabatan || '').trim();
      for (const kpi of group.kpis || []) {
        const name = String(kpi.name || '').trim();
        const key = `${jabatan}||${name}`;
        lookup.set(key, {
          weight: parseFloat(kpi.weight) || 0,
          unit: kpi.unit || '',
          target: kpi.target || '',
          perspective: normalizePerspective(kpi.perspective || kpi.name),
        });
      }
    }
  }

  return lookup;
}

function normalizePerspective(raw) {
  const p = String(raw || '').toLowerCase();
  if (p.includes('finan')) return 'financial';
  if (p.includes('custom') || p.includes('pelanggan') || p.includes('nasabah')) return 'customer';
  if (p.includes('internal') || p.includes('process') || p.includes('proses')) return 'internal_process';
  if (p.includes('learning') || p.includes('growth') || p.includes('culture')) return 'learning_growth';
  return 'financial';
}

function inferPerspective(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('kepuasan') || n.includes('pelanggan') || n.includes('nasabah') || n.includes('npl')) return 'customer';
  if (n.includes('audit') || n.includes('sop') || n.includes('cif') || n.includes('agunan') || n.includes('temuan') || n.includes('verifikasi') || n.includes('dual checking')) {
    return 'internal_process';
  }
  if (n.includes('culture') || n.includes('digital skill') || n.includes('indeks')) return 'learning_growth';
  return 'financial';
}

function normalizeUnit(raw) {
  const u = String(raw || '').toLowerCase();
  if (u.includes('juta') || u.includes('rupiah') || u.includes('rp')) return 'Juta Rupiah';
  if (u.includes('indeks') || u.includes('skor')) return 'Indeks';
  if (u.includes('jumlah') || u.includes('bilangan') || u.includes('angka')) return 'Bilangan';
  if (u.includes('%') || u.includes('persen') || u.includes('percent')) return 'Percent %';
  return raw || 'Percent %';
}

function findTemplateMeta(templateLookup, dbLookup, kpiJabatan, indicatorName) {
  const jabatan = String(kpiJabatan || '').trim();
  const name = String(indicatorName || '').trim();

  const exact = templateLookup.get(`${jabatan}||${name}`);
  if (exact) return exact;

  const dbExact = dbLookup.get(`${jabatan}||${name}`);
  if (dbExact) return dbExact;

  for (const [key, meta] of templateLookup.entries()) {
    const [j, n] = key.split('||');
    if (j !== jabatan) continue;
    if (normText(n) === normText(name)) return meta;
  }

  for (const [key, meta] of dbLookup.entries()) {
    const [j, n] = key.split('||');
    if (j !== jabatan) continue;
    if (normText(n) === normText(name)) return meta;
  }

  for (const [key, meta] of templateLookup.entries()) {
    const [j, n] = key.split('||');
    if (j !== jabatan) continue;
    const nn = normText(n);
    const ni = normText(name);
    if (nn.includes(ni) || ni.includes(nn)) return meta;
  }

  for (const [key, meta] of dbLookup.entries()) {
    const [j, n] = key.split('||');
    if (j !== jabatan) continue;
    const nn = normText(n);
    const ni = normText(name);
    if (nn.includes(ni) || ni.includes(nn)) return meta;
  }

  return {
    weight: 0,
    unit: normalizeUnit(name),
    target: '',
    perspective: inferPerspective(name),
  };
}

function resolvePegawai(row, byNpp, byName) {
  const npp = String(row.NPP || '').trim();
  const name = String(row.Nama || '').trim();
  if (npp && byNpp.has(npp)) return { pegawai: byNpp.get(npp), matchedBy: 'npp' };
  const byNameHit = byName.get(normName(name));
  if (byNameHit) return { pegawai: byNameHit, matchedBy: 'name' };
  return null;
}

async function importKpiIndividuExcel() {
  const filePath = process.argv[2] || path.join(__dirname, 'KPI Individu Upload.xlsx');
  console.log('Membaca file Excel:', filePath);

  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes('kpi individu')) || wb.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
  console.log(`Sheet: "${sheetName}" — ${rows.length} baris`);

  const templateLookup = loadJsonTemplates();
  console.log(`Template metadata loaded: ${templateLookup.size} entri`);

  const [pegawaiRows] = await db.query('SELECT id, npp, name, jabatan, unit_name FROM pegawai');
  const byNpp = new Map(pegawaiRows.map((p) => [String(p.npp).trim(), p]));
  const byName = new Map();
  for (const p of pegawaiRows) {
    const key = normName(p.name);
    if (!byName.has(key)) byName.set(key, p);
  }

  const [existingKpis] = await db.query(
    "SELECT DISTINCT name, jabatan, weight, unit, target, perspective FROM kpis WHERE unit_type = 'pegawai'"
  );
  const dbLookup = new Map();
  for (const kpi of existingKpis) {
    dbLookup.set(`${String(kpi.jabatan || '').trim()}||${String(kpi.name || '').trim()}`, {
      weight: parseFloat(kpi.weight) || 0,
      unit: kpi.unit || '',
      target: kpi.target || '',
      perspective: kpi.perspective || inferPerspective(kpi.name),
    });
  }
  console.log(`DB metadata loaded: ${dbLookup.size} entri`);

  const groups = new Map();
  const unmatched = new Map();
  let matchedByNpp = 0;
  let matchedByName = 0;

  for (const row of rows) {
    const hit = resolvePegawai(row, byNpp, byName);
    if (!hit) {
      const npp = String(row.NPP || '').trim();
      if (!unmatched.has(npp)) unmatched.set(npp, String(row.Nama || '').trim());
      continue;
    }

    if (hit.matchedBy === 'npp') matchedByNpp += 1;
    else matchedByName += 1;

    const { pegawai } = hit;
    const groupKey = `${pegawai.unit_name}||${pegawai.jabatan}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        unit_name: pegawai.unit_name,
        jabatan: pegawai.jabatan,
        kpiJabatan: String(row['KPI Jabatan'] || '').trim(),
        indicators: new Map(),
      });
    }

    const group = groups.get(groupKey);
    const indicator = String(row['Indikator Kinerja Utama'] || '').trim();
    const ukuran = String(row.Ukuran || row['Ukuran'] || '').trim();
    const bobotRaw = row.Bobot ?? row['Bobot'];
    const bobot = bobotRaw !== undefined && bobotRaw !== null && bobotRaw !== ''
      ? parseFloat(bobotRaw) || 0
      : null;
    if (!indicator) continue;

    if (!group.indicators.has(indicator)) {
      group.indicators.set(indicator, { ukuran, bobot });
    }
  }

  console.log(`Pegawai match by NPP (baris): ${matchedByNpp}`);
  console.log(`Pegawai match by Nama (baris): ${matchedByName}`);
  console.log(`Pegawai tidak ditemukan: ${unmatched.size}`);
  console.log(`Grup unit+jabatan: ${groups.size}`);

  const connection = await db.getConnection();
  await connection.beginTransaction();

  let insertedKpis = 0;
  let groupsProcessed = 0;

  try {
    const [wipe] = await connection.query("DELETE FROM kpis WHERE unit_type = 'pegawai'");
    console.log(`KPI individu lama dihapus: ${wipe.affectedRows}`);

    for (const group of groups.values()) {
      for (const [indicator, detail] of group.indicators.entries()) {
        const meta = findTemplateMeta(templateLookup, dbLookup, group.kpiJabatan, indicator);
        const unit = detail.ukuran ? normalizeUnit(detail.ukuran) : (meta.unit || 'Percent %');
        const weight = detail.bobot !== null ? detail.bobot : (meta.weight || 0);
        const id = crypto.randomUUID();

        await connection.query(
          `INSERT INTO kpis (
            id, name, perspective, unit, target, actual, weight, unit_name, jabatan,
            strategy_id, manual_indeks, monthly_data, monthly_target, unit_type, status,
            description, formula, objective
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            indicator,
            meta.perspective,
            unit,
            meta.target || '',
            0,
            weight,
            group.unit_name,
            group.jabatan,
            null,
            null,
            JSON.stringify({}),
            JSON.stringify({}),
            'pegawai',
            'Draft',
            null,
            null,
            null,
          ]
        );
        insertedKpis += 1;
      }

      groupsProcessed += 1;
      if (groupsProcessed % 200 === 0) {
        console.log(`Progress: ${groupsProcessed}/${groups.size} grup...`);
      }
    }

    await connection.commit();

    const [totalRows] = await db.query("SELECT COUNT(*) AS total FROM kpis WHERE unit_type = 'pegawai'");
    console.log('Import KPI Individu selesai.');
    console.log(`Grup diimport: ${groupsProcessed}`);
    console.log(`KPI inserted: ${insertedKpis}`);
    console.log(`Total KPI individu di database: ${totalRows[0].total}`);

    if (unmatched.size > 0) {
      console.log('\nPegawai tidak ditemukan (sample max 20):');
      [...unmatched.entries()].slice(0, 20).forEach(([npp, nama]) => {
        console.log(`- ${npp} | ${nama}`);
      });
    }
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
    await db.end();
  }
}

importKpiIndividuExcel().catch((err) => {
  console.error('Import gagal:', err.message);
  process.exit(1);
});
