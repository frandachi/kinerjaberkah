/**
 * Import KPI Individu untuk pegawai MUTASI (template 2 sheet).
 * Sheet 1 = scorecard SEBELUM mutasi, Sheet 2 = SESUDAH mutasi.
 */
const xlsx = require('xlsx');
const db = require('../db');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_ALIASES = {
  jan: 'Jan', januari: 'Jan',
  feb: 'Feb', februari: 'Feb',
  mar: 'Mar', maret: 'Mar',
  apr: 'Apr', april: 'Apr',
  mei: 'Mei', may: 'Mei',
  jun: 'Jun', juni: 'Jun',
  jul: 'Jul', juli: 'Jul',
  ags: 'Ags', agust: 'Ags', agustus: 'Ags', aug: 'Ags', august: 'Ags',
  sep: 'Sep', sept: 'Sep', september: 'Sep',
  okt: 'Okt', oktober: 'Okt', oct: 'Okt', october: 'Okt',
  nov: 'Nov', november: 'Nov',
  des: 'Des', desember: 'Des', dec: 'Des', december: 'Des',
};

function normText(v) {
  return String(v || '').trim().replace(/\s+/g, ' ');
}

function normalizePerspective(raw) {
  const p = String(raw || '').toLowerCase();
  if (p.includes('finan')) return 'financial';
  if (p.includes('custom') || p.includes('pelanggan') || p.includes('nasabah')) return 'customer';
  if (p.includes('internal') || p.includes('process') || p.includes('proses') || p.includes('bisnis')) {
    return 'internal_process';
  }
  if (p.includes('learning') || p.includes('growth') || p.includes('culture') || p.includes('pembelajaran')) {
    return 'learning_growth';
  }
  return 'financial';
}

function normalizeUnit(raw) {
  const u = String(raw || '').toLowerCase();
  if (u.includes('juta') || u.includes('rupiah') || u.includes('rp')) return 'Juta Rupiah';
  if (u.includes('indeks') || u.includes('skor') || u.includes('score')) return 'Indeks';
  if (u.includes('jumlah') || u.includes('bilangan') || u.includes('angka')) return 'Jumlah';
  if (u.includes('%') || u.includes('persen') || u.includes('percent')) return '%';
  return normText(raw) || '%';
}

function isPercentUnit(unit) {
  const u = String(unit || '').toLowerCase();
  return u.includes('%') || u.includes('persen') || u.includes('percent');
}

function parseNumberLoose(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

function convertWeight(raw) {
  const n = parseNumberLoose(raw);
  if (n == null) return 0;
  if (n > 0 && n <= 1) return Math.round(n * 10000) / 100;
  return n;
}

function convertValue(raw, unit) {
  const n = parseNumberLoose(raw);
  if (n == null) return null;
  if (isPercentUnit(unit) && Math.abs(n) <= 1) {
    return Math.round(n * 10000) / 100;
  }
  return n;
}

function inferPolarity(name) {
  const n = String(name || '').toLowerCase();
  if (
    n.includes('npl') ||
    n.includes('bopo') ||
    n.includes('denda') ||
    n.includes('biaya') ||
    n.includes('efisiensi biaya') ||
    n.includes('incident') ||
    n.includes('insiden')
  ) {
    return 'minimize';
  }
  return 'maximize';
}

function monthIndex(key) {
  return MONTHS.indexOf(key);
}

function lastDayOfMonth(year, monthIdx0) {
  return new Date(year, monthIdx0 + 1, 0).getDate();
}

function detectHeaderRow(rows) {
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    const row = rows[i] || [];
    const joined = row.map((c) => String(c || '').toLowerCase()).join('|');
    if (joined.includes('jabatan') && (joined.includes('indikator') || joined.includes('npp'))) {
      return i;
    }
  }
  return -1;
}

function buildMonthColMap(headerRow, subHeaderRow) {
  const map = {};
  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] || '').trim().toLowerCase();
    const month = MONTH_ALIASES[h] || MONTH_ALIASES[h.replace(/\./g, '')];
    if (!month) continue;
    const subR = String(subHeaderRow?.[c] || '').toLowerCase();
    const subT = String(subHeaderRow?.[c + 1] || '').toLowerCase();
    if (subR.includes('realisasi') || subT.includes('target')) {
      map[month] = { realCol: c, targetCol: c + 1 };
    } else {
      map[month] = { realCol: c, targetCol: c + 1 };
    }
  }
  return map;
}

function defaultMonthColMap() {
  const map = {};
  MONTHS.forEach((m, i) => {
    map[m] = { realCol: 9 + i * 2, targetCol: 10 + i * 2 };
  });
  return map;
}

function parseSheet(ws, sheetLabel) {
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!rows.length) return { meta: null, kpis: [], monthMap: {} };

  const headerIdx = detectHeaderRow(rows);
  let dataStart;
  let monthMap;

  if (headerIdx >= 0) {
    const headerRow = rows[headerIdx];
    const subHeaderRow = rows[headerIdx + 1] || [];
    monthMap = buildMonthColMap(headerRow, subHeaderRow);
    if (!Object.keys(monthMap).length) monthMap = defaultMonthColMap();
    const nextJoined = (rows[headerIdx + 1] || []).map((c) => String(c || '').toLowerCase()).join('|');
    dataStart = nextJoined.includes('realisasi') ? headerIdx + 2 : headerIdx + 1;
  } else {
    monthMap = defaultMonthColMap();
    dataStart = 0;
    while (dataStart < rows.length) {
      const r = rows[dataStart] || [];
      const hasKpi = normText(r[5]) || normText(r[2]) || normText(r[3]);
      const looksTitle = String(r[0] || '').toLowerCase().includes('pengisian');
      if (looksTitle || (!hasKpi && !normText(r[5]))) {
        dataStart += 1;
        continue;
      }
      break;
    }
  }

  let jabatan = '';
  let unitName = '';
  let nama = '';
  let npp = '';
  let perspektif = '';
  const kpis = [];

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i] || [];
    const kpiName = normText(r[5]);
    if (!kpiName) continue;
    if (/^kolom\s/i.test(kpiName) || kpiName.startsWith(':') || /key performance/i.test(kpiName)) {
      continue;
    }

    if (normText(r[0])) jabatan = normText(r[0]);
    if (normText(r[1])) unitName = normText(r[1]);
    if (normText(r[2])) nama = normText(r[2]);
    if (normText(r[3])) npp = normText(r[3]);
    if (normText(r[4])) perspektif = normalizePerspective(r[4]);

    const unit = normalizeUnit(r[6]);
    const weight = convertWeight(r[7]);
    const yearlyTargetRaw = r[8];
    let yearlyTarget = convertValue(yearlyTargetRaw, unit);
    if (yearlyTarget == null) yearlyTarget = parseNumberLoose(yearlyTargetRaw) ?? 0;

    const monthly_data = {};
    const monthly_target = {};
    for (const [month, cols] of Object.entries(monthMap)) {
      const rv = convertValue(r[cols.realCol], unit);
      const tv = convertValue(r[cols.targetCol], unit);
      if (rv != null) monthly_data[month] = String(rv);
      if (tv != null) monthly_target[month] = String(tv);
    }

    const realVals = Object.values(monthly_data).map(Number).filter((n) => Number.isFinite(n));
    const actual = realVals.length ? realVals.reduce((a, b) => a + b, 0) / realVals.length : 0;

    kpis.push({
      name: kpiName,
      perspective: perspektif || 'financial',
      unit,
      weight,
      target: yearlyTarget,
      actual,
      polarity: inferPolarity(kpiName),
      monthly_data,
      monthly_target,
      jabatan,
      unit_name: unitName,
      sort_order: kpis.length + 1,
    });
  }

  const monthsWithData = new Set();
  for (const k of kpis) {
    Object.keys(k.monthly_data).forEach((m) => monthsWithData.add(m));
    Object.keys(k.monthly_target).forEach((m) => monthsWithData.add(m));
  }
  const monthKeys = MONTHS.filter((m) => monthsWithData.has(m));

  return {
    meta: {
      sheet: sheetLabel,
      jabatan,
      unit_name: unitName,
      nama,
      npp,
      month_keys: monthKeys,
    },
    kpis,
    monthMap,
  };
}

function inferPeriods(oldMonths, newMonths, year = new Date().getFullYear()) {
  const oldIdx = oldMonths.map(monthIndex).filter((i) => i >= 0);
  const newIdx = newMonths.map(monthIndex).filter((i) => i >= 0);

  let oldEndIdx = oldIdx.length ? Math.max(...oldIdx) : 4;
  let newStartIdx = newIdx.length ? Math.min(...newIdx) : oldEndIdx + 1;
  if (newStartIdx <= oldEndIdx) newStartIdx = oldEndIdx + 1;

  return {
    old_period_start: `${year}-01-01`,
    old_period_end: `${year}-${String(oldEndIdx + 1).padStart(2, '0')}-${String(lastDayOfMonth(year, oldEndIdx)).padStart(2, '0')}`,
    new_period_start: `${year}-${String(newStartIdx + 1).padStart(2, '0')}-01`,
    new_period_end: `${year}-12-31`,
    effective_date: `${year}-${String(newStartIdx + 1).padStart(2, '0')}-01`,
  };
}

async function findPegawai(npp, nama, pegawaiId) {
  if (pegawaiId) {
    const [byId] = await db.query('SELECT * FROM pegawai WHERE id = ? LIMIT 1', [pegawaiId]);
    if (byId.length) return byId[0];
  }
  if (npp) {
    const [byNpp] = await db.query('SELECT * FROM pegawai WHERE npp = ? LIMIT 1', [npp]);
    if (byNpp.length) return byNpp[0];
  }
  if (nama) {
    const [byName] = await db.query('SELECT * FROM pegawai WHERE LOWER(name) = LOWER(?) LIMIT 1', [nama]);
    if (byName.length) return byName[0];
    const [like] = await db.query(
      'SELECT * FROM pegawai WHERE LOWER(name) LIKE LOWER(?) ORDER BY name LIMIT 5',
      [`%${nama}%`]
    );
    if (like.length === 1) return like[0];
    if (like.length > 1) {
      const err = new Error(
        `Beberapa pegawai cocok dengan nama "${nama}". Pilih pegawai secara eksplisit dari daftar.`
      );
      err.code = 'AMBIGUOUS_PEGAWAI';
      err.candidates = like.map((p) => ({ id: p.id, name: p.name, npp: p.npp, jabatan: p.jabatan, unit_name: p.unit_name }));
      throw err;
    }
  }
  return null;
}

async function insertKpis(connection, kpis, { unit_name, jabatan, locked }) {
  const ids = [];
  for (const kpi of kpis) {
    await new Promise((r) => setTimeout(r, 2));
    const uniq = `kpi_${Date.now()}_${Math.floor(Math.random() * 1e7)}`;
    await connection.query(
      `INSERT INTO kpis (
        id, name, perspective, unit, polarity, target, actual, weight,
        unit_name, jabatan, monthly_data, monthly_target, unit_type,
        status, is_locked, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pegawai', 'Approved', ?, ?, NOW())`,
      [
        uniq,
        kpi.name,
        kpi.perspective,
        kpi.unit,
        kpi.polarity,
        String(kpi.target ?? ''),
        kpi.actual || 0,
        kpi.weight || 0,
        unit_name,
        jabatan,
        JSON.stringify(kpi.monthly_data || {}),
        JSON.stringify(kpi.monthly_target || {}),
        locked ? 1 : 0,
        kpi.sort_order || 0,
      ]
    );
    ids.push(uniq);
  }
  return ids;
}

function parseWorkbookFromBuffer(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  if (!wb.SheetNames || wb.SheetNames.length < 2) {
    const err = new Error('Template harus punya minimal 2 sheet (sebelum & sesudah mutasi).');
    err.code = 'INVALID_TEMPLATE';
    throw err;
  }
  const sheet1Name = wb.SheetNames[0];
  const sheet2Name = wb.SheetNames[1];
  return {
    sheetNames: wb.SheetNames,
    oldParsed: parseSheet(wb.Sheets[sheet1Name], sheet1Name),
    newParsed: parseSheet(wb.Sheets[sheet2Name], sheet2Name),
  };
}

/**
 * @param {Buffer} buffer
 * @param {{ pegawaiId?: string, force?: boolean, createdBy?: string, dryRun?: boolean }} opts
 */
async function importMutationFromBuffer(buffer, opts = {}) {
  const { pegawaiId = null, force = false, createdBy = 'upload-kpi-mutasi', dryRun = false } = opts;
  const { oldParsed, newParsed, sheetNames } = parseWorkbookFromBuffer(buffer);

  if (!oldParsed.kpis.length || !newParsed.kpis.length) {
    const err = new Error('Salah satu sheet tidak punya baris KPI.');
    err.code = 'EMPTY_KPI';
    throw err;
  }

  const npp = oldParsed.meta.npp || newParsed.meta.npp;
  const nama = oldParsed.meta.nama || newParsed.meta.nama;
  const old_unit_name = oldParsed.meta.unit_name;
  const old_jabatan = oldParsed.meta.jabatan;
  const new_unit_name = newParsed.meta.unit_name;
  const new_jabatan = newParsed.meta.jabatan;

  if (!old_unit_name || !old_jabatan || !new_unit_name || !new_jabatan) {
    const err = new Error('Unit/jabatan lama atau baru kosong di Excel.');
    err.code = 'MISSING_META';
    throw err;
  }

  const periods = inferPeriods(oldParsed.meta.month_keys, newParsed.meta.month_keys);
  const pegawai = await findPegawai(npp, nama, pegawaiId);
  if (!pegawai) {
    const err = new Error(
      `Pegawai tidak ditemukan (NPP=${npp || '-'}, Nama=${nama || '-'}). Pilih nama pegawai di layar upload.`
    );
    err.code = 'PEGAWAI_NOT_FOUND';
    throw err;
  }

  const [existingMut] = await db.query(
    "SELECT id, status FROM mutation_history WHERE pegawai_id = ? AND status = 'active'",
    [pegawai.id]
  );
  if (existingMut.length && !force) {
    const err = new Error(
      `Sudah ada mutasi aktif untuk ${pegawai.name}. Centang "Ganti mutasi aktif" untuk mengganti.`
    );
    err.code = 'ACTIVE_MUTATION';
    err.existing_id = existingMut[0].id;
    throw err;
  }

  const preview = {
    sheets: sheetNames.slice(0, 2),
    pegawai: {
      id: pegawai.id,
      name: pegawai.name,
      npp: pegawai.npp,
      jabatan: pegawai.jabatan,
      unit_name: pegawai.unit_name,
    },
    old: {
      unit_name: old_unit_name,
      jabatan: old_jabatan,
      kpi_count: oldParsed.kpis.length,
      month_keys: oldParsed.meta.month_keys,
    },
    new: {
      unit_name: new_unit_name,
      jabatan: new_jabatan,
      kpi_count: newParsed.kpis.length,
      month_keys: newParsed.meta.month_keys,
    },
    periods,
    force_will_replace: existingMut.length > 0,
  };

  if (dryRun) {
    return { dryRun: true, ...preview };
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();
  try {
    if (existingMut.length) {
      await connection.query(
        "UPDATE mutation_history SET status = 'completed' WHERE pegawai_id = ? AND status = 'active'",
        [pegawai.id]
      );
    }

    await connection.query(
      "DELETE FROM kpis WHERE unit_name = ? AND jabatan = ? AND COALESCE(unit_type,'') = 'pegawai'",
      [old_unit_name, old_jabatan]
    );
    await connection.query(
      "DELETE FROM kpis WHERE unit_name = ? AND jabatan = ? AND COALESCE(unit_type,'') = 'pegawai'",
      [new_unit_name, new_jabatan]
    );
    if (pegawai.jabatan !== new_jabatan || pegawai.unit_name !== new_unit_name) {
      await connection.query(
        "DELETE FROM kpis WHERE unit_name = ? AND jabatan = ? AND COALESCE(unit_type,'') = 'pegawai'",
        [pegawai.unit_name, pegawai.jabatan]
      );
    }

    const oldIds = await insertKpis(connection, oldParsed.kpis, {
      unit_name: old_unit_name,
      jabatan: old_jabatan,
      locked: true,
    });
    const newIds = await insertKpis(connection, newParsed.kpis, {
      unit_name: new_unit_name,
      jabatan: new_jabatan,
      locked: false,
    });

    await connection.query(
      `INSERT INTO mutation_history (
        pegawai_id, npp, employee_name,
        old_unit_name, old_jabatan, old_unit_type,
        new_unit_name, new_jabatan, new_unit_type,
        effective_date,
        old_period_start, old_period_end,
        new_period_start, new_period_end,
        old_kpi_ids, new_kpi_ids,
        mutation_type, reason, notes,
        created_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        pegawai.id,
        pegawai.npp || npp,
        pegawai.name || nama,
        old_unit_name,
        old_jabatan,
        'divisi',
        new_unit_name,
        new_jabatan,
        'divisi',
        periods.effective_date,
        periods.old_period_start,
        periods.old_period_end,
        periods.new_period_start,
        periods.new_period_end,
        JSON.stringify(oldIds),
        JSON.stringify(newIds),
        'Mutasi',
        'Import dari template Excel 2 sheet',
        `Scorecard 1 (${oldParsed.meta.month_keys.join('-')}): ${old_unit_name}; Scorecard 2 (${newParsed.meta.month_keys.join('-')}): ${new_unit_name}`,
        createdBy,
      ]
    );

    await connection.query(
      'UPDATE pegawai SET unit_name = ?, jabatan = ? WHERE id = ?',
      [new_unit_name, new_jabatan, pegawai.id]
    );
    await connection.query(
      'UPDATE users SET unit_name = ?, jabatan = ? WHERE pegawai_id = ?',
      [new_unit_name, new_jabatan, pegawai.id]
    );

    await connection.commit();
    return {
      dryRun: false,
      ...preview,
      old_kpi_ids: oldIds,
      new_kpi_ids: newIds,
      message: `Import mutasi berhasil untuk ${pegawai.name}`,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  parseSheet,
  parseWorkbookFromBuffer,
  importMutationFromBuffer,
  findPegawai,
  MONTHS,
};
