/**
 * Import KPI jabatan dari file Excel (format Pemimpin Cabang.xlsx).
 *
 * Usage:
 *   node import-kpi-from-excel.js "/path/to/Pemimpin Cabang.xlsx"
 *   node import-kpi-from-excel.js "/path/to/file.xlsx" "Pemimpin Cabang Kelas 1"
 */
const crypto = require('crypto');
const path = require('path');
const db = require('./db');
const { parseKpiJabatanExcel, resolveJabatanTargets } = require('./lib/parse-kpi-jabatan-excel');
const { buildLockedMonthsFromData } = require('./lib/kpi-realisasi-lock');

const filePath = process.argv[2];
const extraArgs = process.argv.slice(3);
const scopeKcp = extraArgs.includes('--scope=kcp') || extraArgs.includes('--kcp');
const jabatanOverride = extraArgs.find((a) => !a.startsWith('--'));

if (!filePath) {
  console.error('Usage: node import-kpi-from-excel.js <path-to-xlsx> [jabatan] [--scope=kcp]');
  process.exit(1);
}

function isCabangPembantuUnit(unitName) {
  const n = String(unitName || '').toLowerCase();
  return n.includes('cabang pembantu') || n.includes('capem') || n.includes('kcp ');
}

function inferUnitType(unitName) {
  const name = (unitName || '').toUpperCase();
  if (name.includes('KORDINATOR') || name.includes('KOORDINATOR')) return 'kck';
  if (name.includes('CABANG PEMBANTU') || name.includes('CAPEM')) return 'kcp';
  if (name.startsWith('CABANG ') || name.includes('KC ')) return 'kc';
  return 'kc';
}

async function getAllKcpUnits() {
  const [fromPegawai] = await db.query(`
    SELECT DISTINCT unit_name FROM pegawai
    WHERE unit_name LIKE '%Cabang Pembantu%' OR unit_name LIKE '%Capem%' OR unit_name LIKE '%KCP %'
  `);
  const [fromKpis] = await db.query(`
    SELECT DISTINCT unit_name FROM kpis
    WHERE unit_name LIKE '%Cabang Pembantu%'
       OR unit_name LIKE '%Capem%'
       OR unit_type IN ('kcp', 'Kantor Cabang Pembantu', 'Cabang Pembantu')
  `);
  const set = new Set();
  for (const row of [...fromPegawai, ...fromKpis]) {
    if (row.unit_name && isCabangPembantuUnit(row.unit_name)) set.add(row.unit_name);
  }
  return [...set].sort();
}

function jabatanOverwriteWhere(jabatanExcel) {
  const j = String(jabatanExcel || '');
  if (j === 'Pemimpin Cabang Pembantu') {
    return {
      sql: `(jabatan = ? OR ((jabatan LIKE '%Pemimpin Cabang Pembantu%' OR jabatan LIKE '%Pemimpin KCP%') AND jabatan NOT LIKE '%Wakil%'))`,
      params: [j],
    };
  }
  if (j === 'Wakil Pemimpin Cabang Pembantu') {
    return {
      sql: `(jabatan = ? OR jabatan LIKE '%Wakil Pemimpin Cabang Pembantu%')`,
      params: [j],
    };
  }
  if (j === 'Account Officer') {
    return {
      sql: `(jabatan = ? OR jabatan LIKE 'Account Officer%' OR jabatan LIKE 'ND - Account Officer%' OR jabatan LIKE 'Pj. Account Officer%' OR jabatan LIKE 'Pj.Account Officer%')`,
      params: [j],
    };
  }
  if (j === 'Teller') {
    return {
      sql: `(jabatan = ? OR ((jabatan LIKE 'Teller%' OR jabatan LIKE 'ND - Teller%' OR jabatan LIKE 'Pj. Teller%') AND jabatan NOT LIKE 'Head Teller%'))`,
      params: [j],
    };
  }
  if (j === 'Customer Service') {
    return {
      sql: `(jabatan = ? OR ((jabatan LIKE 'Customer Service%' OR jabatan LIKE 'ND - Customer Service%' OR jabatan LIKE 'Pj. Customer Service%') AND jabatan NOT LIKE 'Head Customer Service%'))`,
      params: [j],
    };
  }
  if (j === 'Funding Sales Officer') {
    return {
      sql: `(jabatan = ? OR jabatan LIKE 'Funding Sales Officer%' OR jabatan LIKE 'ND - Funding Sales Officer%' OR jabatan LIKE 'Pj. Funding Sales Officer%')`,
      params: [j],
    };
  }
  if (j === 'Back Office') {
    return {
      sql: `(jabatan = ? OR jabatan LIKE 'Back Office%' OR jabatan LIKE 'ND - Back Office%' OR jabatan LIKE 'Pj. Back Office%')`,
      params: [j],
    };
  }
  return { sql: 'jabatan = ?', params: [j] };
}

async function getUnitsForJabatan(jabatan) {
  const [rows] = await db.query(
    `SELECT DISTINCT unit_name FROM pegawai WHERE jabatan = ? ORDER BY unit_name`,
    [jabatan]
  );
  const units = rows.map((r) => r.unit_name).filter(Boolean);
  if (!scopeKcp) return units;
  return units.filter(isCabangPembantuUnit);
}

async function importForUnit(jabatan, unitName, kpis, options = {}) {
  let deletedCount = 0;
  if (!options.skipDelete) {
    const [deleted] = await db.query(
      'DELETE FROM kpis WHERE jabatan = ? AND unit_name = ?',
      [jabatan, unitName]
    );
    deletedCount = deleted.affectedRows;
  }

  const unitType = inferUnitType(unitName);
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
      unitName,
      jabatan,
      null,
      null,
      JSON.stringify(kpi.monthly_data || {}),
      JSON.stringify(kpi.monthly_target || {}),
      unitType,
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

  return { unitName, deleted: deletedCount, inserted: insertValues.length };
}

async function resolveJabatanList(parsedJabatan, override) {
  if (override) return [override];
  const staticList = resolveJabatanTargets(parsedJabatan);

  const dynamicPatterns = {
    'Pemimpin Seksi Konsumer': {
      where: `(jabatan LIKE 'Pemimpin Seksi Konsumer%' OR jabatan LIKE 'Pj. Pemimpin Seksi Konsumer%' OR jabatan LIKE 'Pj.Pemimpin Seksi Konsumer%')`,
    },
    'Pemimpin Seksi Pelayanan': {
      where: `(jabatan LIKE 'Pemimpin Seksi Pelayanan%' OR jabatan LIKE 'Pj. Pemimpin Seksi Pelayanan%' OR jabatan LIKE 'Pj.Pemimpin Seksi Pelayanan%')`,
    },
    'Relationship Manager': {
      where: `(jabatan LIKE 'Relationship Manager%')`,
    },
    'Head Teller': {
      where: `(jabatan LIKE 'Head Teller%' OR jabatan LIKE 'Pj. Head Teller%' OR jabatan LIKE 'Pj.Head Teller%')`,
    },
    'Teller': {
      // Teller* kecuali Head Teller
      where: `((jabatan LIKE 'Teller%' OR jabatan LIKE 'ND - Teller%' OR jabatan LIKE 'Pj. Teller%' OR jabatan LIKE 'Pj.Teller%') AND jabatan NOT LIKE 'Head Teller%')`,
    },
    'Customer Service': {
      where: `((jabatan LIKE 'Customer Service%' OR jabatan LIKE 'ND - Customer Service%' OR jabatan LIKE 'Pj. Customer Service%') AND jabatan NOT LIKE 'Head Customer Service%')`,
    },
    'Funding Sales Officer': {
      where: `(jabatan LIKE 'Funding Sales Officer%' OR jabatan LIKE 'ND - Funding Sales Officer%' OR jabatan LIKE 'Pj. Funding Sales Officer%')`,
    },
    'Pemimpin Seksi Operasional': {
      where: `(jabatan LIKE 'Pemimpin Seksi Operasional%' OR jabatan LIKE 'Pj. Pemimpin Seksi Operasional%' OR jabatan LIKE 'Pj.Pemimpin Seksi Operasional%')`,
    },
    'Back Office': {
      where: `(jabatan LIKE 'Back Office%' OR jabatan LIKE 'ND - Back Office%' OR jabatan LIKE 'Pj. Back Office%')`,
    },
    'Account Officer': {
      where: `(jabatan LIKE 'Account Officer%' OR jabatan LIKE 'ND - Account Officer%' OR jabatan LIKE 'Pj. Account Officer%' OR jabatan LIKE 'Pj.Account Officer%')`,
    },
    'Pemimpin Cabang Pembantu': {
      where: `((jabatan LIKE '%Pemimpin Cabang Pembantu%' OR jabatan LIKE '%Pemimpin KCP%') AND jabatan NOT LIKE '%Wakil%')`,
    },
    'Wakil Pemimpin Cabang Pembantu': {
      where: `(jabatan LIKE '%Wakil Pemimpin Cabang Pembantu%')`,
    },
  };

  const cfg = dynamicPatterns[parsedJabatan];
  if (cfg) {
    const kcpFilter = scopeKcp
      ? ` AND (unit_name LIKE '%Cabang Pembantu%' OR unit_name LIKE '%Capem%' OR unit_name LIKE '%KCP %')`
      : '';
    const [rows] = await db.query(
      `SELECT DISTINCT jabatan FROM pegawai WHERE ${cfg.where}${kcpFilter} ORDER BY jabatan`
    );
    if (rows.length) return rows.map((r) => r.jabatan);
  }
  return staticList;
}

async function importGroup(jabatanExcel, kpis) {
  const jabatanList = await resolveJabatanList(jabatanExcel, null);
  const totalWeight = kpis.reduce((s, k) => s + (k.weight || 0), 0);
  console.log(`\n########## ${jabatanExcel} ##########`);
  console.log(`KPI template: ${kpis.length}, bobot: ${totalWeight}%`);
  console.log(`Target jabatan DB (${jabatanList.length}): ${jabatanList.join(' | ')}`);

  if (!kpis.length) {
    console.warn('  ⚠ Tidak ada KPI — dilewati');
    return { deleted: 0, inserted: 0 };
  }

  let totalInserted = 0;
  let totalDeleted = 0;

  if (scopeKcp) {
    const units = await getAllKcpUnits();
    const overwrite = jabatanOverwriteWhere(jabatanExcel);
    console.log(`=== Semua unit cabang pembantu: ${units.length} ===`);
    for (const unitName of units) {
      const [deleted] = await db.query(
        `DELETE FROM kpis WHERE unit_name = ? AND ${overwrite.sql}`,
        [unitName, ...overwrite.params]
      );
      totalDeleted += deleted.affectedRows;

      const [atUnit] = await db.query(
        `SELECT DISTINCT jabatan FROM pegawai WHERE unit_name = ? AND ${overwrite.sql} ORDER BY jabatan`,
        [unitName, ...overwrite.params]
      );
      const targets = atUnit.length ? atUnit.map((r) => r.jabatan) : [jabatanExcel];
      let insertedHere = 0;
      for (const jabatan of targets) {
        const result = await importForUnit(jabatan, unitName, kpis, { skipDelete: true });
        insertedHere += result.inserted;
        totalInserted += result.inserted;
      }
      console.log(`  ✓ ${unitName}: hapus ${deleted.affectedRows}, insert ${insertedHere} (${targets.join(', ')})`);
    }
    return { deleted: totalDeleted, inserted: totalInserted };
  }

  for (const jabatan of jabatanList) {
    const units = await getUnitsForJabatan(jabatan);
    if (units.length === 0) {
      console.warn(`  ⚠ Tidak ada unit pegawai untuk jabatan: ${jabatan}`);
      continue;
    }
    console.log(`=== ${jabatan} (${units.length} unit) ===`);
    for (const unitName of units) {
      const result = await importForUnit(jabatan, unitName, kpis);
      totalInserted += result.inserted;
      totalDeleted += result.deleted;
      console.log(`  ✓ ${unitName}: hapus ${result.deleted}, insert ${result.inserted}`);
    }
  }

  return { deleted: totalDeleted, inserted: totalInserted };
}

async function main() {
  const parsed = parseKpiJabatanExcel(filePath);
  const groups = (parsed.groups && parsed.groups.length)
    ? parsed.groups
    : [{ jabatan: jabatanOverride || parsed.jabatan, kpis: parsed.kpis }];

  // Jika override jabatan: hanya impor 1 group dengan KPI dari group yang cocok / semua KPI first
  let workGroups = groups;
  if (jabatanOverride) {
    const match = groups.find((g) => g.jabatan === jabatanOverride)
      || groups.find((g) => g.jabatan.toLowerCase() === jabatanOverride.toLowerCase());
    workGroups = [{
      jabatan: jabatanOverride,
      kpis: match ? match.kpis : parsed.kpis,
    }];
  }

  if (scopeKcp) {
    workGroups = workGroups.filter((g) => {
      const j = String(g.jabatan || '').toLowerCase();
      return j && j !== 'jabatan' && !j.includes('koordinator');
    });
  }

  console.log(`File: ${path.basename(filePath)}`);
  console.log(`Sheet: ${parsed.sheetName}`);
  console.log(`Scope: ${scopeKcp ? 'cabang pembantu saja (timpa data lama)' : 'semua unit jabatan'}`);
  console.log(`Grup jabatan: ${workGroups.map((g) => `${g.jabatan}(${g.kpis.length})`).join(', ')}`);

  let totalInserted = 0;
  let totalDeleted = 0;

  for (const group of workGroups) {
    const result = await importGroup(group.jabatan, group.kpis);
    totalInserted += result.inserted;
    totalDeleted += result.deleted;
  }

  console.log(`\n===== TOTAL =====`);
  console.log(`Selesai. ${totalDeleted} KPI dihapus, ${totalInserted} KPI diinsert.`);
}

main()
  .catch((err) => {
    console.error('Import gagal:', err.message);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
