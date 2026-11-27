const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorize');
const { auditMiddleware, logActivity } = require('../middleware/audit');
const { getGapSummary, getGapList, inferLevelUnit } = require('../lib/kpi-gap-utils');
const { buildKpiRecords, getTemplateKpis } = require('../lib/kpi-template-engine');
const { computeKpiYtdScores, computeYtdActual, normalizeUnit, predikatFromSkor, predikatFromPencapaian } = require('../lib/kpi-scoring');
const { buildJabatanUnitScope } = require('../lib/kpi-scope');
const {
  mergeMonthlyDataRespectingLock,
  mergeMonthlyTarget,
  parseLockedMonths,
  getMutationAllowedMonths,
  MONTHS: REALISASI_MONTHS,
} = require('../lib/kpi-realisasi-lock');
const { getClosedMonths } = require('../lib/periode-kalender');
const {
  setupMasterKpiFin01,
  setupAllMasterKpis,
  ensureMasterCodeForKpi,
  getMasterUnit,
  aggregateMasterFromChildren,
  syncChildMasterLink,
  reaggregateIfChildOrMaster,
  resolveMasterCodeForName,
  listMasterKpis,
  getMasterDetail,
  parseJsonField: parseMasterJsonField,
  ensureSchema: ensureMasterSchema,
  ensureMasterParentRow,
  groupKeyForName,
} = require('../lib/kpi-master');
const { syncKpiUnitFromPemimpin, mirrorIndividuPemimpinToUnit } = require('../lib/sync-kpi-unit-from-pemimpin');
const { syncKpiIndividuFromUnit } = require('../lib/sync-kpi-individu-from-unit');
const {
  normSpace,
  normalizeJabatan,
  namesSimilar,
  buildPegawaiIndex,
  matchPegawai,
  sanitizeKpi,
  lastClosedMonthIndexWib,
  trimTrailingZeroMonths,
  looksLikeFullRupiah,
  currencyMagnitude,
  medianOf,
  rupiahToJutaKpi,
  createMasterResolver,
} = require('../lib/kpi-individu-import');

function isMasterKpiId(id) {
  return typeof id === 'string' && /^KPI-[A-Z]+-\d+$/i.test(id);
}

/** Persist free-typed objective into master objectives table. */
async function ensureObjectiveRow(connection, { name, perspective }) {
  const nm = String(name || '').trim();
  if (!nm) return null;
  const persp = String(perspective || '').trim();
  const [rows] = await connection.query(
    'SELECT id, name FROM objectives WHERE name = ? AND (perspective = ? OR ? = \'\') LIMIT 1',
    [nm, persp, persp]
  );
  if (rows.length) return rows[0];
  const id = 'obj_' + Date.now() + Math.floor(Math.random() * 1000);
  await connection.query(
    'INSERT INTO objectives (id, name, perspective, description, divisi) VALUES (?, ?, ?, ?, ?)',
    [id, nm, persp, '', '']
  );
  return { id, name: nm };
}

/** Persist free-typed KPI name into strategies master (linked to objective if known). */
async function ensureStrategyRow(connection, { name, perspective, unit, description, formula, objectiveName, objectiveId }) {
  const nm = String(name || '').trim();
  if (!nm) return null;
  const [rows] = await connection.query(
    'SELECT id, name FROM strategies WHERE name = ? LIMIT 1',
    [nm]
  );
  if (rows.length) return rows[0];
  let objId = objectiveId || null;
  if (!objId && objectiveName) {
    const obj = await ensureObjectiveRow(connection, { name: objectiveName, perspective });
    objId = obj?.id || null;
  }
  const id = 'str_' + Date.now() + Math.floor(Math.random() * 1000);
  await connection.query(
    'INSERT INTO strategies (id, objective_id, name, perspective, unit, description, formula) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, objId, nm, perspective || '', unit || '%', description || '', formula || '']
  );
  return { id, name: nm };
}

function normalizeKpiWritePayload(kpi) {
  const out = { ...kpi };
  out.name = String(out.name || '').trim();
  out.unit_name = String(out.unit_name || '').trim();
  out.objective = String(out.objective || '').trim();
  // Simpan label satuan master bila ada (mis. "Peringkat"), atau kode tipe.
  // Scoring tetap lewat normalizeUnit(label) → percentage/currency/score/number.
  const unitRaw = String(out.unit || '').trim() || 'percentage';
  out.unit = unitRaw;
  // Pastikan label/kode bisa dipetakan; jangan collapse "Peringkat"→percentage.
  if (!normalizeUnit(unitRaw)) out.unit = 'percentage';
  out.perspective = String(out.perspective || '').trim();
  const unitType = String(out.unit_type || 'pegawai');
  out.unit_type = unitType;
  let jabatan = String(out.jabatan || '').trim();
  if (!jabatan) {
    jabatan = unitType === 'pegawai' ? '' : (out.unit_name || '-');
  }
  out.jabatan = jabatan;
  const manualParent = String(out.parent_kpi_manual || '').trim();
  out.parent_kpi_manual = manualParent || null;
  out.pic = String(out.pic || '').trim() || null;
  const desc = String(out.description || '').replace(/\n?\(KPI Induk:.*?\)\s*$/s, '').trim();
  out.description = manualParent ? (desc ? desc + '\n' : '') + `(KPI Induk: ${manualParent})` : desc;
  const indeks = out.manual_indeks !== undefined && out.manual_indeks !== null && out.manual_indeks !== ''
    ? out.manual_indeks
    : (out.indeks !== undefined && out.indeks !== null && out.indeks !== '' ? out.indeks : null);
  // Indeks manual Average Index Excel: fraksi 1–5 (mis. 1.4, 4.6). 0/kosong = hitung otomatis.
  const manual = parseFloat(indeks);
  out.manual_indeks = Number.isFinite(manual) && manual > 0 && manual <= 5.5 ? manual : null;
  return out;
}

let kpiFormColsReady = false;
async function ensureKpiFormColumns(connection) {
  if (kpiFormColsReady) return;
  const cols = [
    ['parent_kpi_manual', 'VARCHAR(255) NULL'],
    ['pic', 'VARCHAR(255) NULL'],
    ['monthly_submitted', 'JSON NULL'],
  ];
  for (const [name, def] of cols) {
    try {
      await connection.query(`ALTER TABLE kpis ADD COLUMN ${name} ${def}`);
    } catch (e) {
      /* duplicate column or no permission — continue */
    }
  }
  try {
    await connection.query('SELECT parent_kpi_manual, pic FROM kpis LIMIT 0');
    kpiFormColsReady = true;
  } catch (e) {
    console.warn('KPI form columns not ready:', e.message);
  }
}

function extractParentManual(k) {
  const direct = String(k.parent_kpi_manual || '').trim();
  if (direct) return direct;
  const m = String(k.description || '').match(/\(KPI Induk:\s*([\s\S]*?)\)\s*$/);
  return m ? m[1].trim() : '';
}

function normalizeKpiNameKey(name) {
  return String(name || '')
    .trim()
    .replace(/^-\s*/, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Cek nama KPI unik dalam 1 unit + jabatan + unit_type (case-insensitive, abaikan prefix sub-KPI "-").
 *  Individu (pegawai) dan Unit (divisi/cabang/…) boleh memakai nama yang sama. */
async function assertUniqueKpiName(dbConn, { name, unit_name, jabatan, excludeId = null, unit_type = null }) {
  const key = normalizeKpiNameKey(name);
  if (!key || !unit_name || !jabatan) return;

  const typeKey = String(unit_type || 'pegawai').trim().toLowerCase() || 'pegawai';
  const [rows] = await dbConn.query(
    `SELECT id, name, unit_type FROM kpis
     WHERE unit_name = ? AND jabatan = ?
       AND LOWER(TRIM(COALESCE(unit_type, 'pegawai'))) = ?`,
    [unit_name, jabatan, typeKey]
  );
  const exclude = excludeId != null ? String(excludeId) : null;
  const dup = rows.find(
    (r) => normalizeKpiNameKey(r.name) === key && (!exclude || String(r.id) !== exclude)
  );
  if (dup) {
    const err = new Error(
      `Nama KPI "${name}" sudah ada untuk jabatan "${jabatan}" di unit "${unit_name}". Gunakan nama lain.`
    );
    err.status = 409;
    throw err;
  }
}

function parseKpiJsonFields(k) {
  return {
    ...k,
    monthly_data: typeof k.monthly_data === 'string' ? JSON.parse(k.monthly_data) : (k.monthly_data || {}),
    monthly_target: typeof k.monthly_target === 'string' ? JSON.parse(k.monthly_target) : (k.monthly_target || {}),
    monthly_data_locked: parseLockedMonths(k.monthly_data_locked),
    monthly_submitted: (() => {
      const raw = k.monthly_submitted;
      if (!raw) return {};
      if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch {
          return {};
        }
      }
      return {};
    })(),
    parent_kpi_manual: extractParentManual(k),
  };
}

const router = express.Router();

function isPemimpinCabangJabatan(jabatan = '') {
  const j = String(jabatan).toLowerCase();
  return j.includes('pemimpin cabang') && !j.includes('wakil');
}

function getPredikatLabel(score) {
  const s = parseFloat(score);
  if (Number.isNaN(s) || s <= 0) return '-';
  if (s < 60) return 'Kurang';
  if (s < 80) return 'Cukup';
  if (s < 100) return 'Baik';
  if (s <= 110) return 'Sangat Baik';
  return 'Istimewa';
}

function computeBankSummaryStats(kpis) {
  if (!kpis.length) {
    return {
      skorTotal: 0,
      pencapaianTotal: 0,
      kpiTercapai: 0,
      kpiTotal: 0,
      kpiTercapaiPersen: 0,
      klasifikasi: '-',
      scoredCount: 0,
      coveragePersen: 0,
      skorAkhir: 0,
      predikatSkor: '-',
    };
  }

  let scoredWeight = 0;
  let weightedPencapaian = 0;
  let kpiTercapai = 0;
  let scoredCount = 0;
  let sumWeight = 0;
  let sumHasil = 0;

  kpis.forEach((kpi) => {
    const weight = parseFloat(kpi.weight) || 0;
    const { pencapaian, hasil } = computeKpiYtdScores(kpi);
    sumWeight += weight;
    sumHasil += hasil || 0;
    const md = typeof kpi.monthly_data === 'string'
      ? (() => { try { return JSON.parse(kpi.monthly_data); } catch { return {}; } })()
      : (kpi.monthly_data || {});
    const hasData = Object.values(md).some((v) => v !== undefined && v !== null && v !== '' && Number(v) !== 0);

    if (hasData || pencapaian > 0) {
      const w = weight > 0 ? weight : 1;
      scoredWeight += w;
      weightedPencapaian += w * Math.max(0, Math.min(pencapaian, 120));
      scoredCount += 1;
      if (pencapaian >= 100) kpiTercapai += 1;
    }
  });

  const pencapaianTotal = scoredWeight > 0 ? weightedPencapaian / scoredWeight : 0;
  const kpiTotal = kpis.length;
  const skorAkhir = sumWeight > 0 ? (sumHasil / sumWeight) * 100 : 0;
  const predikatSkor = predikatFromSkor(skorAkhir);

  return {
    skorTotal: pencapaianTotal,
    pencapaianTotal,
    kpiTercapai,
    kpiTotal,
    kpiTercapaiPersen: scoredCount > 0 ? (kpiTercapai / scoredCount) * 100 : 0,
    klasifikasi: predikatFromPencapaian(pencapaianTotal, scoredCount > 0),
    scoredCount,
    coveragePersen: kpiTotal > 0 ? Math.round((scoredCount / kpiTotal) * 100) : 0,
    skorAkhir,
    predikatSkor,
  };
}

/** Setup / refresh SEMUA master KPI dari nama unik di DB */
router.post('/master/setup-all', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('SETUP_ALL_MASTER_KPI'), async (req, res) => {
  try {
    const result = await setupAllMasterKpis(db);
    res.json({ message: 'Semua master KPI siap', ...result });
  } catch (error) {
    console.error('setup all master error:', error.message);
    res.status(500).json({ message: 'Gagal setup master KPI: ' + error.message });
  }
});

/** Alias lama — setup semua (termasuk KPI-FIN-01) */
router.post('/master/setup-fin-01', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('SETUP_MASTER_KPI_FIN_01'), async (req, res) => {
  try {
    const result = await setupMasterKpiFin01(db);
    res.json({ message: 'Master KPI siap (semua kode)', ...result });
  } catch (error) {
    console.error('setup master fin-01 error:', error.message);
    res.status(500).json({ message: 'Gagal setup master KPI: ' + error.message });
  }
});

/** Daftar semua master KPI (untuk drill-down Scorecard/Laporan) */
router.get('/master', authenticateToken, async (req, res) => {
  try {
    const perspective = (req.query.perspective || 'all').toString();
    const items = await listMasterKpis(db, { perspective });
    res.json({
      total: items.length,
      perspective,
      items,
    });
  } catch (error) {
    console.error('list master kpi error:', error.message);
    res.status(500).json({ message: 'Gagal memuat daftar master KPI' });
  }
});

/** Detail master KPI + daftar anak + nilai konsolidasi */
router.get('/master/:code', authenticateToken, async (req, res) => {
  try {
    const code = String(req.params.code || '').toUpperCase();
    const detail = await getMasterDetail(db, code);
    if (!detail) {
      return res.status(404).json({
        message: `Master ${code} belum ada. Jalankan POST /kpis/master/setup-all`,
      });
    }
    res.json(detail);
  } catch (error) {
    console.error('get master kpi error:', error.message);
    res.status(500).json({ message: 'Gagal memuat master KPI' });
  }
});

/** Paksa hitung ulang agregasi master dari anak */
router.post('/master/:code/reaggregate', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('REAGGREGATE_MASTER_KPI'), async (req, res) => {
  try {
    const code = String(req.params.code || '').toUpperCase();
    const result = await aggregateMasterFromChildren(db, code);
    res.json({ message: `Agregasi ${code} selesai`, ...result });
  } catch (error) {
    console.error('reaggregate master error:', error.message);
    res.status(500).json({ message: 'Gagal agregasi master KPI: ' + error.message });
  }
});

/** Ringkasan konsolidasi KPI seluruh Bank Sumut — hanya admin/superadmin */
router.get('/bank-summary', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Hanya admin yang dapat melihat konsolidasi seluruh Bank Sumut' });
    }
    const [allKpis] = await db.query(
      "SELECT id, name, unit, polarity, weight, monthly_data, monthly_target, manual_indeks, unit_type, unit_name, jabatan FROM kpis WHERE COALESCE(unit_type, '') <> 'master' AND COALESCE(pic, '') <> 'from-individu-pemimpin'"
    );
    const stats = computeBankSummaryStats(allKpis);
    const jabatanSet = new Set(allKpis.map((r) => r.jabatan).filter(Boolean));
    res.json({
      ...stats,
      scope: 'bank',
      unit_name: null,
      jabatan_count: jabatanSet.size,
      label: 'Pencapaian KPI Konsolidasi Bank Sumut',
    });
  } catch (error) {
    console.error('bank-summary error:', error.message);
    res.status(500).json({ message: 'Gagal memuat ringkasan konsolidasi Bank Sumut' });
  }
});

/**
 * Ringkasan konsolidasi per unit kantor.
 * - Role user: selalu unit_name milik user (semua jabatan di unit tersebut)
 * - Admin/superadmin: ?unit_name=... atau tanpa filter = seluruh bank
 */
router.get('/unit-summary', authenticateToken, async (req, res) => {
  try {
    const isUser = req.user.role === 'user';
    let unitName = (req.query.unit_name || '').trim();

    if (isUser) {
      unitName = req.user.unit_name || '';
      if (!unitName) {
        return res.json({
          ...computeBankSummaryStats([]),
          scope: 'unit',
          unit_name: null,
          label: 'Konsolidasi Unit Kantor',
          jabatan_count: 0,
        });
      }
    } else if (!unitName && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Hanya admin yang dapat melihat konsolidasi seluruh Bank Sumut' });
    }

    let rows;
    if (unitName) {
      // Unit scorecard mengikuti salinan sync dari Individu pemimpin (bukan upload lama / pegawai).
      const [unitKpis] = await db.query(
        `SELECT id, name, unit, polarity, weight, monthly_data, monthly_target, manual_indeks, unit_type, unit_name, jabatan
         FROM kpis
         WHERE unit_name = ?
           AND COALESCE(unit_type, '') NOT IN ('master', 'pegawai')`,
        [unitName]
      );
      rows = unitKpis;
    } else {
      const [allKpis] = await db.query(
        "SELECT id, name, unit, polarity, weight, monthly_data, monthly_target, manual_indeks, unit_type, unit_name, jabatan FROM kpis WHERE COALESCE(unit_type, '') <> 'master' AND COALESCE(pic, '') <> 'from-individu-pemimpin'"
      );
      rows = allKpis;
    }

    const jabatanSet = new Set(rows.map((r) => r.jabatan).filter(Boolean));
    const stats = computeBankSummaryStats(rows);
    res.json({
      ...stats,
      scope: unitName ? 'unit' : 'bank',
      unit_name: unitName || null,
      jabatan_count: jabatanSet.size,
      label: unitName
        ? `Konsolidasi Unit Kantor — ${unitName}`
        : 'Pencapaian KPI Konsolidasi Bank Sumut',
    });
  } catch (error) {
    console.error('unit-summary error:', error.message);
    res.status(500).json({ message: 'Gagal memuat ringkasan konsolidasi unit kantor' });
  }
});

// Unique KPI catalog for Master KPI tab (~300 rows vs ~18k instances)
router.get('/catalog', authenticateToken, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const perspective = String(req.query.perspective || '').trim();
    // Katalog Master KPI: sertakan juga KPI divisi hasil sinkron dari pemimpin
    // (pic='from-individu-pemimpin') — tanpa ini hampir semua KPI divisi hilang
    // dari daftar master. Baris senama tetap digabung per groupKey (tidak duplikat).
    // Pengecualian pic hanya untuk agregat bank/unit-summary (hindari double count).
    const where = ["COALESCE(unit_type, '') <> 'master'"];
    const params = [];
    if (search) {
      where.push('(name LIKE ? OR objective LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (req.user.role === 'user') {
      where.push('unit_name = ?');
      params.push(req.user.unit_name || '');
    }
    // Ambil flat lalu grup di JS pakai groupKey + perspektif ternormalisasi
    // agar ejaan mirip (DBLM/(DBLM), Index/Indeks, Learning & Growth) jadi 1 baris.
    const sql = `
      SELECT id, name, perspective, unit, polarity, status, description, formula, objective,
             weight, target, kpi_code, parent_kpi_id, unit_name
      FROM kpis
      WHERE ${where.join(' AND ')}`;
    const [flat] = await db.query(sql, params);
    const {
      groupKeyForName,
      normalizePerspectiveKey,
      canonicalDisplayName,
    } = require('../lib/kpi-master');
    const wantPersp = perspective && perspective !== 'all'
      ? normalizePerspectiveKey(perspective)
      : null;
    const groups = new Map();
    for (const row of flat) {
      const gKey = groupKeyForName(row.name) || String(row.name || '').trim().toLowerCase();
      const persp = normalizePerspectiveKey(row.perspective);
      let g = groups.get(gKey);
      if (!g) {
        g = {
          id: row.id,
          name: canonicalDisplayName(row.name),
          perspective: persp,
          perspCounts: new Map([[persp, 0]]),
          unit: row.unit,
          polarity: row.polarity,
          status: row.status,
          description: row.description,
          formula: row.formula,
          objective: row.objective,
          weight: row.weight,
          target: row.target,
          target_variants: new Set(),
          kpi_code: row.kpi_code || null,
          parent_kpi_id: row.parent_kpi_id || null,
          instance_count: 0,
          units: new Set(),
          _nameCounts: new Map(),
          codeCounts: new Map(),
        };
        groups.set(gKey, g);
      }
      g.instance_count += 1;
      g.perspCounts.set(persp, (g.perspCounts.get(persp) || 0) + 1);
      if (row.unit_name) g.units.add(row.unit_name);
      const nm = String(row.name || '');
      g._nameCounts.set(nm, (g._nameCounts.get(nm) || 0) + 1);
      if (row.kpi_code) {
        g.codeCounts.set(row.kpi_code, (g.codeCounts.get(row.kpi_code) || 0) + 1);
        g.kpi_code = row.kpi_code;
      }
      if (row.parent_kpi_id) g.parent_kpi_id = row.parent_kpi_id;
      if (row.unit) g.unit = row.unit;
      if (row.polarity) g.polarity = row.polarity;
      if (row.status) g.status = row.status;
      if (row.description) g.description = row.description;
      if (row.formula) g.formula = row.formula;
      if (row.objective) g.objective = row.objective;
      if (row.weight != null && Number(row.weight) > Number(g.weight || 0)) g.weight = row.weight;
      const t = row.target == null ? '' : String(row.target).trim();
      g.target_variants.add(t);
      if (g.target_variants.size === 1) g.target = row.target;
      else g.target = null;
    }
    const rows = [...groups.values()]
      .map((g) => {
        const top = [...g._nameCounts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0];
        const majCode = g.codeCounts.size
          ? [...g.codeCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
          : g.kpi_code;
        const codePersp = majCode && /^KPI-FIN-/i.test(majCode) ? 'financial'
          : majCode && /^KPI-CUS-/i.test(majCode) ? 'customer'
          : majCode && /^KPI-IBP-/i.test(majCode) ? 'internal_process'
          : majCode && /^KPI-LNG-/i.test(majCode) ? 'learning_growth'
          : null;
        const majPersp = [...g.perspCounts.entries()].sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          if (codePersp) {
            if (a[0] === codePersp) return -1;
            if (b[0] === codePersp) return 1;
          }
          return a[0].localeCompare(b[0]);
        })[0][0];
        return {
          id: g.id,
          name: canonicalDisplayName(top?.[0] || g.name),
          perspective: majPersp,
          unit: g.unit,
          polarity: g.polarity,
          status: g.status,
          description: g.description,
          formula: g.formula,
          objective: g.objective,
          weight: g.weight,
          target: g.target_variants.size === 1 ? (g.target_variants.values().next().value || null) : null,
          target_variants: g.target_variants.size,
          kpi_code: majCode,
          parent_kpi_id: g.parent_kpi_id,
          instance_count: g.instance_count,
          unit_count: g.units.size,
        };
      })
      .filter((r) => !wantPersp || r.perspective === wantPersp)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'id'));
    // Status di tab Master KPI mengikuti baris master (Approved = Aktif),
    // bukan MAX(status) anak. "Draft" > "Approved" secara teks, jadi satu anak Draft
    // membuat seluruh nama tampil Draft padahal masternya sudah Aktif.
    const [masterStatuses] = await db.query(
      "SELECT id, name, perspective, status, polarity, unit FROM kpis WHERE COALESCE(unit_type,'') = 'master'"
    );
    const normKey = (name, perspective) =>
      `${groupKeyForName(name) || String(name || '').trim().toLowerCase()}||${normalizePerspectiveKey(perspective)}`;
    const statusByCode = new Map();
    const statusByName = new Map();
    const masterByCode = new Map();
    const masterByName = new Map();
    for (const m of masterStatuses) {
      if (/^\[DEPRECATED\]/i.test(String(m.name || ''))) continue;
      const st = m.status || 'Approved';
      const key = String(m.id || '').toUpperCase();
      statusByCode.set(key, st);
      statusByName.set(normKey(m.name, m.perspective), st);
      masterByCode.set(key, m);
      masterByName.set(normKey(m.name, m.perspective), m);
    }
    for (const row of rows) {
      const code = String(row.kpi_code || row.parent_kpi_id || '').toUpperCase();
      const master = (code && masterByCode.get(code)) || masterByName.get(normKey(row.name, row.perspective));
      if (master) {
        if (master.status) row.status = master.status || 'Approved';
        // Jangan pakai MAX(polarity) anak — satu instance salah mengubah tampilan Master KPI
        if (master.polarity) row.polarity = master.polarity;
        if (master.unit) row.unit = master.unit;
      }
      // Lock polarisasi khusus
      const nm = String(row.name || '');
      if (/pembiayaan\s*syariah/i.test(nm) && /dblm/i.test(nm)) row.polarity = 'maximize_a';
      if (/penyelesa+iaan?\s+temuan\s+audit/i.test(nm) && /komitmen/i.test(nm)) row.polarity = 'maximize_b';
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-KPI-Catalog-Count', String(rows.length));
    res.json(rows);
  } catch (error) {
    console.error('KPI catalog error:', error.message);
    res.status(500).json({ message: 'Gagal memuat katalog KPI' });
  }
});

// Distinct unit names for Master KPI filter dropdown
router.get('/units', authenticateToken, async (req, res) => {
  try {
    const where = ["COALESCE(unit_type, '') <> 'master'", "unit_name IS NOT NULL", "TRIM(unit_name) <> ''"];
    const params = [];
    if (req.user.role === 'user') {
      where.push('unit_name = ?');
      params.push(req.user.unit_name || '');
    }
    const [rows] = await db.query(
      `SELECT DISTINCT unit_name FROM kpis WHERE ${where.join(' AND ')} ORDER BY unit_name ASC`,
      params
    );
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.json(rows.map((r) => r.unit_name).filter(Boolean));
  } catch (error) {
    console.error('KPI units error:', error.message);
    res.status(500).json({ message: 'Gagal memuat daftar unit' });
  }
});

// Bobot aggregate for Master KPI charts (optional unit filter)
router.get('/weight-summary', authenticateToken, async (req, res) => {
  try {
    const unitName = String(req.query.unit_name || '').replace(/^\[[^\]]+\]\s*/, '').trim();
    const search = String(req.query.search || '').trim();
    const where = ["COALESCE(unit_type, '') <> 'master'", "COALESCE(pic, '') <> 'from-individu-pemimpin'"];
    const params = [];
    if (req.user.role === 'user') {
      where.push('unit_name = ?');
      params.push(req.user.unit_name || '');
    } else if (unitName && unitName !== 'all') {
      where.push('unit_name = ?');
      params.push(unitName);
    }
    if (search) {
      where.push('name LIKE ?');
      params.push(`%${search}%`);
    }
    const [rows] = await db.query(
      `SELECT perspective,
        ROUND(SUM(COALESCE(weight,0)), 1) AS total_weight,
        COUNT(*) AS kpi_count
       FROM kpis
       WHERE ${where.join(' AND ')}
       GROUP BY perspective`,
      params
    );
    const [[tot]] = await db.query(
      `SELECT ROUND(SUM(COALESCE(weight,0)), 1) AS total_weight, COUNT(*) AS kpi_count
       FROM kpis WHERE ${where.join(' AND ')}`,
      params
    );
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.json({
      totalBobot: Number(tot?.total_weight) || 0,
      count: Number(tot?.kpi_count) || 0,
      byPersp: rows.map((r) => ({
        key: r.perspective,
        value: Number(r.total_weight) || 0,
        count: Number(r.kpi_count) || 0,
      })),
    });
  } catch (error) {
    console.error('KPI weight-summary error:', error.message);
    res.status(500).json({ message: 'Gagal memuat ringkasan bobot' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    await ensureKpiFormColumns(db);
    // NOTE: the built frontend expects a bare array (not {data, pagination}).
    // Use ?fields=list to omit monthly JSON (~half payload) for management/dashboard.
    // Use ?fields=full (default) when monthly_data is required (realisasi / scoring).
    const {
      search = '',
      fields = 'full',
      unit_name: filterUnitName = '',
      jabatan: filterJabatan = '',
      unit_type: filterUnitType = '',
      perspective: filterPerspective = '',
      include_master: includeMaster = '',
    } = req.query;

    const isParentCascade = req.query.scope === 'parent-cascade';
    const fieldMode = String(fields || 'full').toLowerCase();

    const LIST_COLS =
      'id, kpi_code, name, perspective, unit, polarity, target, actual, weight, unit_name, jabatan, strategy_id, unit_type, parent_kpi_id, parent_kpi_manual, pic, status, description, formula, objective, sort_order, is_locked, manual_indeks, approved_at, created_at';
    const SCORE_COLS =
      LIST_COLS + ', monthly_data, monthly_target, monthly_data_locked, monthly_submitted';
    const CASCADE_COLS =
      'id, name, unit_type, unit_name, jabatan, perspective, parent_kpi_id, kpi_code';

    let selectCols = '*';
    if (isParentCascade) selectCols = CASCADE_COLS;
    else if (fieldMode === 'list' || fieldMode === 'summary') selectCols = LIST_COLS;
    else if (fieldMode === 'score') selectCols = SCORE_COLS;

    let queryStr = `SELECT ${selectCols} FROM kpis`;
    const queryParams = [];
    let whereClauses = [];

    // Master rows are for aggregation only — exclude unless explicitly requested
    if (!isParentCascade && String(includeMaster) !== '1' && String(includeMaster).toLowerCase() !== 'true') {
      whereClauses.push("COALESCE(unit_type, '') <> 'master'");
    }

    if (isParentCascade) {
      // Opsi KPI Induk untuk form cascading (boleh diakses role user)
      whereClauses.push(
        "unit_type IN ('corporate','divisi','bidang','kck','kc','kcp','unit_kp')"
      );

      // Filter ketat ke unit induk organisasi (unit-induk.json / cabInduk)
      const childUnit = String(req.query.unit_name || '').replace(/^\[[^\]]+\]\s*/, '').trim();
      const childType = String(req.query.unit_type || '').trim().toLowerCase();
      if (childUnit) {
        let parentName = null;
        try {
          const { parentUnitName } = require('../lib/atasanLangsung');
          parentName = parentUnitName(childUnit);
        } catch (e) {
          parentName = null;
        }

        if (parentName) {
          whereClauses.push('unit_name = ?');
          queryParams.push(parentName);
        } else if (childType === 'divisi') {
          whereClauses.push("unit_type = 'corporate'");
        } else if (childType === 'bidang') {
          whereClauses.push("unit_type = 'divisi'");
        } else if (childType === 'pegawai') {
          whereClauses.push('unit_name = ?');
          queryParams.push(childUnit);
        } else {
          // Tidak ada induk di struktur organisasi → skip (hasil kosong)
          return res.json([]);
        }
      }

      if (req.user.role === 'user') {
        // Unit sendiri (semua level atas) + KPI corporate bank-wide
        whereClauses.push('(unit_name = ? OR unit_type = ?)');
        queryParams.push(req.user.unit_name || '', 'corporate');
      }
    } else if (req.user.role === 'user') {
      // Pemimpin Cabang + scope=unit-office: seluruh KPI di unit kantor (unit + anggota)
      {
        let unitVariants = [req.user.unit_name].filter(Boolean);
        try {
          const { variantNames, resolveUnitScope, sqlInPlaceholders } = require('../lib/unitScope');
          const scope = await resolveUnitScope(db, req.user);
          unitVariants = (scope.units && scope.units.length) ? scope.units : variantNames(req.user.unit_name);
        } catch (_) {
          try {
            const { variantNames } = require('../lib/unitScope');
            unitVariants = variantNames(req.user.unit_name);
          } catch { /* ignore */ }
        }
        if (!unitVariants.length) unitVariants = [req.user.unit_name || ''];

        if (req.query.scope === 'unit-office' && isPemimpinCabangJabatan(req.user.jabatan)) {
          whereClauses.push(`unit_name IN (${unitVariants.map(()=>'?').join(',')})`);
          queryParams.push(...unitVariants);
        } else {
          let extra = null;
          try {
            const [urows] = await db.query('SELECT pegawai_id FROM users WHERE id = ? LIMIT 1', [req.user.id]);
            const pid = urows[0]?.pegawai_id;
            if (pid) {
              const [muts] = await db.query(
                `SELECT old_unit_name, old_jabatan FROM mutation_history
                 WHERE pegawai_id = ? AND status = 'active'
                 ORDER BY effective_date DESC, id DESC LIMIT 1`,
                [pid]
              );
              if (muts[0]?.old_unit_name && muts[0]?.old_jabatan) extra = muts[0];
            }
          } catch (_) { /* mutation table may be missing */ }
          if (extra) {
            let oldVariants = [extra.old_unit_name];
            try {
              const { variantNames } = require('../lib/unitScope');
              oldVariants = variantNames(extra.old_unit_name);
            } catch { /* ignore */ }
            const allUnits = [...new Set([...unitVariants, ...oldVariants])];
            whereClauses.push(
              `((jabatan = ? AND unit_name IN (${allUnits.map(()=>'?').join(',')})) OR (jabatan = ? AND unit_name IN (${allUnits.map(()=>'?').join(',')})))`
            );
            queryParams.push(req.user.jabatan, ...allUnits, extra.old_jabatan, ...allUnits);
          } else {
            whereClauses.push(`jabatan = ? AND unit_name IN (${unitVariants.map(()=>'?').join(',')})`);
            queryParams.push(req.user.jabatan, ...unitVariants);
          }
        }
      }
    } else {
      // Admin/superadmin: honor optional filters; admin non-SA dikunci ke unit + anak unit
      const unitName = String(filterUnitName || '').replace(/^\[[^\]]+\]\s*/, '').trim();
      let scope = { unrestricted: req.user.role === 'superadmin', units: null };
      try {
        const { resolveUnitScope, unitInScope, sqlInPlaceholders } = require('../lib/unitScope');
        scope = await resolveUnitScope(db, req.user);
        if (!scope.unrestricted) {
          const units = scope.units || [];
          if (!units.length) {
            return res.json([]);
          }
          if (unitName) {
            if (!unitInScope(unitName, units)) return res.json([]);
            const matched = units.filter((u) => unitInScope(u, [unitName]) || unitInScope(unitName, [u]));
            const useUnits = matched.length ? matched : [unitName];
            whereClauses.push(`unit_name IN (${sqlInPlaceholders(useUnits.length)})`);
            queryParams.push(...useUnits);
          } else {
            whereClauses.push(`unit_name IN (${sqlInPlaceholders(units.length)})`);
            queryParams.push(...units);
          }
        } else if (unitName) {
          try {
            const { variantNames, sqlInPlaceholders: ph } = require('../lib/unitScope');
            const variants = variantNames(unitName);
            whereClauses.push(`unit_name IN (${ph(variants.length)})`);
            queryParams.push(...variants);
          } catch {
            whereClauses.push('unit_name = ?');
            queryParams.push(unitName);
          }
        }
      } catch (scopeErr) {
        console.warn('KPI unit scope:', scopeErr.message);
        if (unitName) {
          whereClauses.push('unit_name = ?');
          queryParams.push(unitName);
        }
      }
      if (filterJabatan) {
        whereClauses.push('jabatan = ?');
        queryParams.push(String(filterJabatan));
      }
      if (filterUnitType) {
        whereClauses.push('unit_type = ?');
        queryParams.push(String(filterUnitType));
      }
      if (filterPerspective) {
        whereClauses.push('perspective = ?');
        queryParams.push(String(filterPerspective));
      }
    }

    if (search) {
      whereClauses.push('(name LIKE ? OR unit_name LIKE ?)');
      const searchParam = `%${search}%`;
      queryParams.push(searchParam, searchParam);
    }

    if (whereClauses.length > 0) {
      queryStr += ' WHERE ' + whereClauses.join(' AND ');
    }

    queryStr += ' ORDER BY sort_order ASC, created_at ASC, id ASC';

    const [kpis] = await db.query(queryStr, queryParams);

    const parsedKpis = (isParentCascade || fieldMode === 'list' || fieldMode === 'summary'
      ? kpis
      : kpis.map(parseKpiJsonFields)
    ).map((k) => ({ ...k, parent_kpi_manual: extractParentManual(k), pic: k.pic || '' }));

    if (isParentCascade || fieldMode === 'list' || fieldMode === 'summary') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
      res.setHeader('Pragma', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
      res.setHeader('Pragma', 'no-cache');
    }
    res.setHeader('X-KPI-Fields', isParentCascade ? 'cascade' : fieldMode);
    res.setHeader('X-KPI-Count', String(parsedKpis.length));

    res.json(parsedKpis);
  } catch (error) {
    console.error('Get KPIs error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/', authenticateToken, authorizeRole('superadmin', 'admin', 'user'), auditMiddleware('CREATE_KPI'), async (req, res) => {
  try {
    let kpi = normalizeKpiWritePayload(req.body || {});
    // Pegawai hanya boleh membuat KPI untuk jabatan/unit sendiri
    if (req.user.role === 'user') {
      kpi.jabatan = req.user.jabatan;
      kpi.unit_name = req.user.unit_name;
      kpi.unit_type = 'pegawai';
    }
    if (!kpi.name) {
      return res.status(400).json({ message: 'Nama KPI wajib diisi' });
    }
    if (!kpi.unit_name) {
      kpi.unit_name = '-';
    }
    if (!kpi.jabatan) kpi.jabatan = kpi.unit_name || '-';
    // jabatan tidak wajib ketat — default ke unit_name

    // Persist free-typed objective / strategy into master tables
    try {
      if (kpi.objective) {
        await ensureObjectiveRow(db, { name: kpi.objective, perspective: kpi.perspective });
      }
      const strat = await ensureStrategyRow(db, {
        name: kpi.name,
        perspective: kpi.perspective,
        unit: kpi.unit,
        description: kpi.description,
        formula: kpi.formula,
        objectiveName: kpi.objective,
      });
      if (strat?.id && !kpi.strategy_id) kpi.strategy_id = strat.id;
    } catch (e) {
      console.warn('ensure objective/strategy on create:', e.message);
    }

    await assertUniqueKpiName(db, {
      name: kpi.name,
      unit_name: kpi.unit_name,
      jabatan: kpi.jabatan,
      unit_type: kpi.unit_type || 'pegawai',
    });

    const id = 'kpi_' + Date.now() + Math.floor(Math.random() * 1000);
    const masterCode = await ensureMasterCodeForKpi(db, {
      name: kpi.name,
      perspective: kpi.perspective,
      unit: kpi.unit,
      polarity: kpi.polarity,
    });
    // Hormati label satuan dari form (mis. Peringkat); jangan collapse ke kode tipe.
    kpi.unit = String(kpi.unit || '').trim() || (await getMasterUnit(db, masterCode)) || 'percentage';

    await ensureKpiFormColumns(db);
    await db.query(
      'INSERT INTO kpis (id, kpi_code, name, perspective, unit, polarity, target, actual, weight, unit_name, jabatan, strategy_id, monthly_data, monthly_target, unit_type, parent_kpi_id, parent_kpi_manual, pic, status, description, formula, objective, manual_indeks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id, masterCode, kpi.name, kpi.perspective, kpi.unit, kpi.polarity || 'maximize', kpi.target ?? 0, kpi.actual ?? 0, kpi.weight ?? 0,
        kpi.unit_name, kpi.jabatan, kpi.strategy_id || null, JSON.stringify(kpi.monthly_data || {}), JSON.stringify(kpi.monthly_target || {}),
        kpi.unit_type || 'pegawai', masterCode, kpi.parent_kpi_manual || null, kpi.pic || null,
        kpi.status || 'Draft', kpi.description || null, kpi.formula || null, kpi.objective || null, kpi.manual_indeks
      ]
    );

    if (masterCode) {
      try { await aggregateMasterFromChildren(db, masterCode); } catch (e) { console.warn('master aggregate after create:', e.message); }
    }

    const [newKpis] = await db.query('SELECT * FROM kpis WHERE id = ?', [id]);
    res.status(201).json(parseKpiJsonFields(newKpis[0]));
  } catch (error) {
    console.error('Create KPI error:', error.message);
    if (error.status === 409) {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/gaps', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { type = 'no_kpi', level = 'all', search = '' } = req.query;
    const summary = await getGapSummary(db);
    const items = await getGapList(db, { type, level, search });
    res.json({ summary, items });
  } catch (error) {
    console.error('Get KPI gaps error:', error.message);
    res.status(500).json({ message: 'Gagal mengambil data gap KPI' });
  }
});

router.post('/generate-templates', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('GENERATE_KPI_TEMPLATES'), async (req, res) => {
  try {
    const { pairs = [], scope = 'selected' } = req.body;
    let targets = pairs;

    if (scope === 'all_divisi') {
      targets = await getGapList(db, { type: 'no_kpi', level: 'divisi' });
    } else if (scope === 'all_no_kpi') {
      targets = await getGapList(db, { type: 'no_kpi' });
    }

    if (!targets.length) {
      return res.json({ message: 'Tidak ada jabatan yang perlu digenerate', generated: 0, skipped: 0, details: [] });
    }

    let generated = 0;
    let skipped = 0;
    const details = [];

    for (const pair of targets) {
      const { unit_name, jabatan } = pair;
      if (!unit_name || !jabatan) { skipped++; continue; }

      const [existing] = await db.query(
        'SELECT id FROM kpis WHERE unit_name = ? AND jabatan = ? LIMIT 1',
        [unit_name, jabatan]
      );
      if (existing.length > 0) {
        skipped++;
        details.push({ unit_name, jabatan, status: 'skipped', reason: 'KPI sudah ada' });
        continue;
      }

      const levelUnit = pair.level_unit || inferLevelUnit(unit_name);
      const { source } = getTemplateKpis(unit_name, jabatan, levelUnit);
      const records = buildKpiRecords(unit_name, jabatan, levelUnit);

      for (const kpi of records) {
        const id = 'kpi_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        await db.query(
          `INSERT INTO kpis (id, name, perspective, unit, polarity, target, actual, weight, unit_name, jabatan, strategy_id, monthly_data, unit_type, status, description, formula, objective)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, kpi.name, kpi.perspective, kpi.unit, kpi.polarity || 'maximize', kpi.target || '', kpi.actual || 0, kpi.weight || 0,
            kpi.unit_name, kpi.jabatan, null, JSON.stringify(kpi.monthly_data || {}),
            kpi.unit_type || 'pegawai', kpi.status || 'Draft',
            kpi.description || null, kpi.formula || null, kpi.objective || null,
          ]
        );
        generated++;
      }

      details.push({ unit_name, jabatan, status: 'generated', source, kpiCount: records.length });
    }

    res.json({
      message: `Berhasil generate ${generated} KPI untuk ${details.filter(d => d.status === 'generated').length} jabatan`,
      generated,
      skipped,
      details,
    });
  } catch (error) {
    console.error('Generate KPI templates error:', error.message);
    res.status(500).json({ message: 'Gagal generate template KPI: ' + error.message });
  }
});

/**
 * Import KPI Individu dari template per pegawai (tanpa pilih unit/jabatan di layar).
 * Body: { dryRun: boolean, entries: [{ key, sheet, rows, nama, npp, jabatan, unit_name, kpis: [...] }] }
 */
router.post('/import-individu', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  const dryRun = req.body?.dryRun !== false;
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  if (!entries.length) return res.status(400).json({ message: 'Tidak ada data pegawai di file' });
  if (entries.length > 1000) return res.status(400).json({ message: 'Maksimal 1000 pegawai per upload' });

  try {
    await ensureKpiFormColumns(db);
    await ensureMasterSchema(db);
    const [pegawaiRows] = await db.query('SELECT id, name, npp, jabatan, unit_name FROM pegawai');
    const index = buildPegawaiIndex(pegawaiRows);

    const seenPegawai = new Map();
    const seenPair = new Map();
    const maxMonthIdx = lastClosedMonthIndexWib();
    const matches = entries.map((entry) => matchPegawai(index, entry));
    // Blok yang jabatannya sama dengan data pegawai diproses lebih dulu, agar menang saat duplikat/konflik.
    const jabatanFits = (i) => {
      const p = matches[i].pegawai;
      return p && entries[i].jabatan && normalizeJabatan(entries[i].jabatan) === normalizeJabatan(p.jabatan) ? 0 : 1;
    };
    const order = entries.map((_, i) => i).sort((a, b) => jabatanFits(a) - jabatanFits(b) || a - b);
    const results = new Array(entries.length);
    for (const i of order) results[i] = evaluate(entries[i], i, matches[i]);

    function evaluate(entry, i, match) {
      const kpis = (Array.isArray(entry.kpis) ? entry.kpis : [])
        .map((k, idx) => sanitizeKpi(k, idx, maxMonthIdx))
        .filter(Boolean);
      const droppedMonths = [...new Set(kpis.flatMap((k) => k.futureDropped))];
      const zeroMonths = trimTrailingZeroMonths(kpis);
      const base = {
        key: entry.key ?? i,
        sheet: normSpace(entry.sheet),
        rows: normSpace(entry.rows),
        nama: normSpace(entry.nama),
        npp: normSpace(entry.npp),
        jabatan: normSpace(entry.jabatan),
        kpiCount: kpis.length,
        weightTotal: Math.round(kpis.reduce((s, k) => s + k.weight, 0) * 100) / 100,
        warnings: [],
        kpis,
      };
      if (!kpis.length) return { ...base, status: 'invalid', message: 'Tidak ada baris KPI' };

      if (!match.pegawai) return { ...base, status: 'unmatched', message: match.reason };

      const p = match.pegawai;
      const pegawai = { id: p.id, name: p.name, npp: p.npp, jabatan: normSpace(p.jabatan), unit_name: normSpace(p.unit_name) };
      if (!pegawai.jabatan || !pegawai.unit_name) {
        return { ...base, pegawai, status: 'invalid', message: 'Data pegawai belum punya unit/jabatan' };
      }
      if (seenPegawai.has(p.id)) {
        return { ...base, pegawai, status: 'duplicate', message: `Pegawai sama dengan sheet "${seenPegawai.get(p.id)}"` };
      }
      const pairKey = `${pegawai.unit_name.toLowerCase()}|${pegawai.jabatan.toLowerCase()}`;
      if (seenPair.has(pairKey)) {
        return {
          ...base,
          pegawai,
          status: 'conflict',
          message: `Unit & jabatan sama dengan ${seenPair.get(pairKey)}; KPI individu disimpan per unit+jabatan`,
        };
      }
      seenPegawai.set(p.id, base.sheet || base.nama);
      seenPair.set(pairKey, p.name);

      if (match.via === 'npp' && base.nama && !namesSimilar(base.nama, p.name)) {
        base.warnings.push(`Nama di file "${base.nama}" berbeda dengan data pegawai`);
      }
      if (base.jabatan && normalizeJabatan(base.jabatan) !== normalizeJabatan(pegawai.jabatan)) {
        base.warnings.push(`Jabatan di file "${base.jabatan}" berbeda; dipakai jabatan pegawai`);
      }
      if (Math.abs(base.weightTotal - 100) > 0.5) {
        base.warnings.push(`Total bobot ${base.weightTotal}`);
      }
      if (droppedMonths.length) {
        base.warnings.push(`Realisasi ${droppedMonths.join(', ')} diabaikan (bulan belum tutup buku); target tetap disimpan`);
      }
      if (zeroMonths.length) {
        base.warnings.push(`Realisasi ${zeroMonths.join(', ')} bernilai 0 untuk semua KPI, dianggap belum diisi`);
      }
      return { ...base, pegawai, matchedBy: match.via, status: 'ready' };
    }

    const ready = results.filter((r) => r.status === 'ready');
    for (const r of ready) {
      const [ex] = await db.query(
        "SELECT COUNT(*) AS n, GROUP_CONCAT(DISTINCT NULLIF(pic, '') SEPARATOR ', ') AS pics FROM kpis WHERE unit_name = ? AND jabatan = ? AND COALESCE(unit_type, '') = 'pegawai'",
        [r.pegawai.unit_name, r.pegawai.jabatan]
      );
      r.existingCount = Number(ex[0]?.n) || 0;
      if (r.existingCount) {
        const pics = ex[0].pics ? ` (PIC: ${ex[0].pics})` : '';
        r.warnings.push(`Menimpa ${r.existingCount} KPI yang sudah ada${pics}`);
      }
    }

    const [masterRows] = await db.query('SELECT code, name, perspective, unit, polarity, match_names FROM master_kpis');
    const [masterIds] = await db.query("SELECT id FROM kpis WHERE id LIKE 'KPI-%'");
    const masters = createMasterResolver(masterRows, masterIds.map((row) => row.id));
    const parentIds = new Set(masterIds.map((row) => row.id));
    const reusedCodes = new Map();
    const firstSeen = new Set();
    const [peerRows] = await db.query(
      "SELECT kpi_code, unit_name, jabatan, monthly_data, monthly_target, actual, target FROM kpis WHERE unit = 'currency' AND kpi_code IS NOT NULL AND COALESCE(unit_type, '') <> 'master' AND id NOT LIKE 'KPI-%'"
    );
    const peersByCode = new Map();
    for (const row of peerRows) {
      const mag = currencyMagnitude(parseKpiJsonFields(row));
      if (!mag) continue;
      if (!peersByCode.has(row.kpi_code)) peersByCode.set(row.kpi_code, []);
      peersByCode.get(row.kpi_code).push({ owner: `${row.unit_name}||${row.jabatan}`.toLowerCase(), mag });
    }
    const peerMagnitude = (code, owner) =>
      medianOf((peersByCode.get(code) || []).filter((p) => p.owner !== owner).map((p) => p.mag));
    for (const r of ready) {
      r.masterNew = 0;
      r.masterReused = 0;
      r.kpis = r.kpis.map((k) => {
        const m = masters.resolve(k);
        if (!m) return k;
        if (m.isNew && !firstSeen.has(m.code)) {
          firstSeen.add(m.code);
          r.masterNew += 1;
        } else {
          r.masterReused += 1;
          if (!m.isNew) reusedCodes.set(m.code, m);
        }
        // Polarisasi & satuan dari file Excel diutamakan (jangan ditimpa master lama
        // yang masih "maximize"/"minimize" generik — itu yang membuat skor A/B/C salah).
        const unit = k.unit || m.unit || 'percentage';
        const polarity = k.polarity || m.polarity || 'maximize_a';
        if (polarity && polarity !== m.polarity) m.polarity = polarity;
        if (unit && unit !== m.unit) m.unit = unit;
        return { ...k, name: m.name, unit, polarity, kpi_code: m.code };
      });
      const converted = [];
      const owner = `${r.pegawai.unit_name}||${r.pegawai.jabatan}`.toLowerCase();
      r.kpis = r.kpis.map((k) => {
        if (k.unit !== 'currency' || !looksLikeFullRupiah(k, peerMagnitude(k.kpi_code, owner))) return k;
        converted.push(k.name);
        return { ...k, ...rupiahToJutaKpi(k) };
      });
      if (converted.length) r.warnings.push(`Nilai Rupiah penuh dikonversi ke Juta Rupiah (÷ 1.000.000): ${converted.join('; ')}`);
    }

    let inserted = 0;
    const touchedCodes = new Set();
    if (!dryRun && ready.length) {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        const createdBy = req.user?.username || req.user?.id || null;
        const needParent = [...masters.created, ...[...reusedCodes.values()].filter((m) => !parentIds.has(m.code))];
        for (const m of needParent) {
          await ensureMasterParentRow(conn, {
            code: m.code,
            name: m.name,
            perspective: m.perspective,
            unit: m.unit,
            polarity: m.polarity,
            matchNames: [m.name],
            matchKeys: [groupKeyForName(m.name)],
            description: `Master KPI ${m.name} (${m.code}) — akumulasi seluruh unit/jabatan`,
            objective: `Konsolidasi ${m.name}`,
          });
        }
        // Update polaritas/satuan master yang dipakai ulang agar selaras file Excel.
        for (const m of reusedCodes.values()) {
          if (!m.code) continue;
          await conn.query(
            'UPDATE master_kpis SET polarity = COALESCE(?, polarity), unit = COALESCE(?, unit) WHERE code = ?',
            [m.polarity || null, m.unit || null, m.code]
          ).catch(() => null);
          await conn.query(
            "UPDATE kpis SET polarity = COALESCE(?, polarity), unit = COALESCE(?, unit) WHERE id = ? AND COALESCE(unit_type,'') = 'master'",
            [m.polarity || null, m.unit || null, m.code]
          ).catch(() => null);
        }
        for (const r of ready) {
          const [oldCodes] = await conn.query(
            "SELECT DISTINCT kpi_code FROM kpis WHERE unit_name = ? AND jabatan = ? AND COALESCE(unit_type, '') = 'pegawai' AND kpi_code IS NOT NULL",
            [r.pegawai.unit_name, r.pegawai.jabatan]
          );
          oldCodes.forEach((row) => touchedCodes.add(row.kpi_code));
          await conn.query(
            "DELETE FROM kpis WHERE unit_name = ? AND jabatan = ? AND COALESCE(unit_type, '') = 'pegawai'",
            [r.pegawai.unit_name, r.pegawai.jabatan]
          );
          const values = r.kpis.map((k, i) => {
            if (k.kpi_code) touchedCodes.add(k.kpi_code);
            return [
              `kpi_${Date.now()}_${inserted + i}_${Math.floor(Math.random() * 1e6)}`,
              k.kpi_code || null, k.kpi_code || null,
              k.name, k.perspective, k.unit, k.polarity, k.target, k.actual, k.weight,
              r.pegawai.unit_name, r.pegawai.jabatan,
              JSON.stringify(k.monthly_data), JSON.stringify(k.monthly_target),
              'pegawai', 'Draft', r.pegawai.name, k.sort_order, createdBy,
            ];
          });
          await conn.query(
            'INSERT INTO kpis (id, kpi_code, parent_kpi_id, name, perspective, unit, polarity, target, actual, weight, unit_name, jabatan, monthly_data, monthly_target, unit_type, status, pic, sort_order, created_by) VALUES ?',
            [values]
          );
          inserted += values.length;
          r.status = 'saved';
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
      for (const code of touchedCodes) {
        try {
          await aggregateMasterFromChildren(db, code);
        } catch (err) {
          console.error('Import KPI individu: agregasi master gagal', code, err.message);
        }
      }
    }

    const count = (s) => results.filter((r) => r.status === s).length;
    const summary = {
      total: results.length,
      ready: count('ready') + count('saved'),
      saved: count('saved'),
      unmatched: count('unmatched'),
      conflict: count('conflict') + count('duplicate'),
      invalid: count('invalid'),
      kpis: dryRun ? ready.reduce((s, r) => s + r.kpiCount, 0) : inserted,
      masterNew: masters.created.length,
      masterReused: reusedCodes.size,
    };
    if (!dryRun) {
      logActivity(req.user.id, 'IMPORT_KPI_INDIVIDU', {
        summary,
        saved: results
          .filter((r) => r.status === 'saved')
          .map((r) => ({ npp: r.pegawai.npp, unit_name: r.pegawai.unit_name, jabatan: r.pegawai.jabatan, kpis: r.kpiCount })),
      }, req.ip);
    }
    res.json({
      dryRun,
      summary,
      newMasters: masters.created.map(({ code, name, perspective }) => ({ code, name, perspective })),
      results: results.map(({ kpis, ...r }) => r),
    });
  } catch (error) {
    console.error('Import KPI individu error:', error.message);
    res.status(500).json({ message: 'Gagal import KPI individu: ' + error.message });
  }
});

router.post('/bulk', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('BULK_INSERT_KPI'), async (req, res) => {
  try {
    const kpis = req.body;
    if (!kpis || !kpis.length) return res.json([]);

    for (const kpi of kpis) {
      if (!kpi.objective && !kpi.name) continue;

      const objName = kpi.objective || `Tujuan Strategis - ${kpi.perspective}`;

      let [existingObj] = await db.query('SELECT id FROM objectives WHERE name = ? AND perspective = ?', [objName, kpi.perspective]);
      let objectiveId;

      if (existingObj.length === 0) {
        objectiveId = 'obj_' + Date.now() + Math.floor(Math.random() * 1000);
        await db.query(
          'INSERT INTO objectives (id, name, perspective, description, divisi) VALUES (?, ?, ?, ?, ?)',
          [objectiveId, objName, kpi.perspective, '', '']
        );
      } else {
        objectiveId = existingObj[0].id;
      }

      let [existingStrategy] = await db.query('SELECT id FROM strategies WHERE name = ? AND objective_id = ?', [kpi.name, objectiveId]);
      let strategyId;

      if (existingStrategy.length === 0) {
        strategyId = 'strat_' + Date.now() + Math.floor(Math.random() * 1000);
        await db.query(
          'INSERT INTO strategies (id, objective_id, name, perspective, unit, description, formula) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [strategyId, objectiveId, kpi.name, kpi.perspective, kpi.unit || '%', kpi.description || '', kpi.formula || '']
        );
      } else {
        strategyId = existingStrategy[0].id;
      }

      kpi.strategy_id = strategyId;
      kpi.objective = objName;
    }

    // Hapus KPI lama sebelum insert:
    // - pegawai: by unit_name + jabatan
    // - unit pusat/kantor: by unit_name + unit_type (termasuk salinan from-individu-pemimpin)
    //   agar upload Excel tidak kalah dengan sync yang targetnya kosong / jabatan beda ejaan (Pj.)
    const cleared = new Set();
    for (const kpi of kpis) {
      const unit_name = kpi.unit_name || '';
      const ut = String(kpi.unit_type || '').toLowerCase();
      if (!unit_name) continue;
      if (ut && ut !== 'pegawai' && ut !== 'master') {
        const key = `ut|${unit_name}|${ut}`;
        if (cleared.has(key)) continue;
        cleared.add(key);
        await db.query(
          `DELETE FROM kpis
           WHERE unit_name = ?
             AND LOWER(COALESCE(unit_type,'')) = ?
             AND COALESCE(unit_type,'') <> 'master'`,
          [unit_name, ut]
        );
      } else {
        const jabatan = kpi.jabatan || '';
        const key = `jb|${unit_name}|${jabatan}`;
        if (cleared.has(key)) continue;
        cleared.add(key);
        await db.query(
          "DELETE FROM kpis WHERE unit_name = ? AND jabatan = ? AND COALESCE(unit_type,'') <> 'master'",
          [unit_name, jabatan]
        );
      }
    }

    // Satu nama KPI per unit+jabatan dalam batch (hindari double dari Excel)
    const seenNames = new Set();
    const dedupedKpis = [];
    for (const kpi of kpis) {
      const key = `${kpi.unit_name || ''}|${kpi.jabatan || ''}|${normalizeKpiNameKey(kpi.name)}`;
      if (!normalizeKpiNameKey(kpi.name) || seenNames.has(key)) continue;
      seenNames.add(key);
      dedupedKpis.push(kpi);
    }

    if (!dedupedKpis.length) {
      return res.json({ message: 'Tidak ada KPI unik untuk diimport', inserted: 0 });
    }

    // Satuan currency = Juta Rupiah. File Excel (mis. Human Capital) sering berisi
    // Rupiah penuh meski label "Juta Rupiah" — samakan dengan import Individu.
    const convertedNames = [];
    for (let i = 0; i < dedupedKpis.length; i++) {
      const k = dedupedKpis[i];
      if (String(k.unit || '') !== 'currency' || !looksLikeFullRupiah(k)) continue;
      dedupedKpis[i] = { ...k, ...rupiahToJutaKpi(k) };
      convertedNames.push(k.name);
    }

    const kpiValues = dedupedKpis.map((kpi, index) => [
      'kpi_' + Date.now() + '_' + index,
      kpi.name, kpi.perspective, kpi.unit, kpi.polarity || 'maximize', kpi.target || 0, kpi.actual || 0, kpi.weight || 0,
      kpi.unit_name, kpi.jabatan, kpi.strategy_id || null, null, JSON.stringify(kpi.monthly_data || {}),
      JSON.stringify(kpi.monthly_target || {}),
      kpi.unit_type || null, kpi.parent_kpi_id || null, kpi.status || 'Draft',
      kpi.description || null, kpi.formula || null, kpi.objective || null
    ]);

    await db.query(
      'INSERT INTO kpis (id, name, perspective, unit, polarity, target, actual, weight, unit_name, jabatan, strategy_id, manual_indeks, monthly_data, monthly_target, unit_type, parent_kpi_id, status, description, formula, objective) VALUES ?',
      [kpiValues]
    );

    res.json({
      message: convertedNames.length
        ? `Bulk insert successful (${convertedNames.length} KPI currency dikonversi Rupiah→Juta)`
        : 'Bulk insert successful',
      inserted: dedupedKpis.length,
      skippedDuplicates: kpis.length - dedupedKpis.length,
      convertedToJuta: convertedNames,
    });
  } catch (error) {
    console.error('Bulk KPI error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/sync-unit-from-pemimpin', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('SYNC_KPI_UNIT'), async (req, res) => {
  try {
    const result = await syncKpiUnitFromPemimpin(db);
    const byOrg = {};
    for (const u of result.units || []) {
      byOrg[u.org] = (byOrg[u.org] || 0) + 1;
    }
    res.json({
      message: `KPI Unit disinkronkan dari Individu pemimpin (Divisi/Departemen/UKK/Unit/Cabang/Project): ${result.unitCount} unit, ${result.inserted} KPI` +
        (result.deletedUpload ? `; hapus upload unit kantor lama ${result.deletedUpload}` : ''),
      deleted: result.deleted,
      deletedUpload: result.deletedUpload || 0,
      inserted: result.inserted,
      unitCount: result.unitCount,
      heads: result.heads,
      skipped: result.skipped.length,
      byOrg,
    });
  } catch (error) {
    console.error('sync kpi unit error:', error.message);
    res.status(500).json({ message: 'Gagal sinkronisasi KPI Unit: ' + error.message });
  }
});

/** Reset KPI Individu pemimpin mengikuti KPI Unit Kerja (Unit → Individu). */
router.post('/sync-individu-from-unit', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('SYNC_KPI_INDIVIDU_FROM_UNIT'), async (req, res) => {
  try {
    const result = await syncKpiIndividuFromUnit(db);
    res.json({
      message: `KPI Individu pemimpin di-reset dari KPI Unit: ${result.unitCount} unit, hapus ${result.deleted}, isi ${result.inserted}` +
        (result.skipped.length ? `; lewati ${result.skipped.length} unit tanpa pemimpin` : ''),
      deleted: result.deleted,
      inserted: result.inserted,
      unitCount: result.unitCount,
      heads: result.heads,
      skipped: result.skipped.length,
      skipSample: (result.skipped || []).slice(0, 20),
    });
  } catch (error) {
    console.error('sync individu from unit error:', error.message);
    res.status(500).json({ message: 'Gagal reset Individu dari Unit: ' + error.message });
  }
});

router.put('/bulk/sort', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !items.length) return res.json({ message: 'No items provided' });

    for (const item of items) {
      if (item.id !== undefined && item.sort_order !== undefined) {
        await db.query('UPDATE kpis SET sort_order = ? WHERE id = ?', [item.sort_order, item.id]);
      }
    }

    res.json({ message: 'Urutan berhasil diperbarui' });
  } catch (error) {
    console.error('Update sort order error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.put('/:id/realisasi', authenticateToken, auditMiddleware('UPDATE_KPI_REALISASI'), async (req, res) => {
  try {
    const { id } = req.params;
    const { monthly_data: incomingMonthly, monthly_target: incomingTarget } = req.body;

    const [rows] = await db.query('SELECT * FROM kpis WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'KPI tidak ditemukan' });
    }

    const existing = parseKpiJsonFields(rows[0]);

    if (req.user.role === 'user') {
      if (req.user.jabatan !== existing.jabatan || req.user.unit_name !== existing.unit_name) {
        return res.status(403).json({ message: 'Anda hanya bisa mengisi realisasi KPI Anda sendiri' });
      }
    }

    // Kunci edit mengikuti Periode & Kalender (bulan tutup buku) + batasan mutasi.
    // Bulan yang belum ditutup tetap bisa direvisi meski sudah diajukan/disetujui.
    // Superadmin: bypass semua kunci (boleh koreksi unit/individu kapan saja).
    // Admin: hanya ikut tutup buku (bukan rentang mutasi).
    const closedMonths = await getClosedMonths(db);
    const closedSet = new Set(closedMonths || []);
    const isSuperadmin = req.user.role === 'superadmin';
    let allowedMonths = null;
    if (isSuperadmin) {
      allowedMonths = null;
    } else if (req.user.role === 'admin') {
      allowedMonths = closedSet.size
        ? (REALISASI_MONTHS || []).filter((m) => !closedSet.has(m))
        : null;
    } else {
      const mutationMonths = await getMutationAllowedMonths(db, existing);
      allowedMonths = mutationMonths;
      if (closedSet.size) {
        const open = (REALISASI_MONTHS || []).filter((m) => !closedSet.has(m));
        allowedMonths = Array.isArray(mutationMonths) && mutationMonths.length
          ? mutationMonths.filter((m) => !closedSet.has(m))
          : open;
      }
    }

    const prevMd = existing.monthly_data && typeof existing.monthly_data === 'object' ? existing.monthly_data : {};
    const prevMt = existing.monthly_target && typeof existing.monthly_target === 'object' ? existing.monthly_target : {};

    const mergedMonthly = mergeMonthlyDataRespectingLock(
      existing,
      incomingMonthly || {},
      req.user.role,
      allowedMonths
    );
    const mergedTarget = incomingTarget
      ? mergeMonthlyTarget(existing, incomingTarget, allowedMonths)
      : (existing.monthly_target || {});
    const unitType = normalizeUnit(existing.unit);
    const actual = computeYtdActual(unitType, mergedMonthly);

    // Jangan timpa target tahunan (dari Excel/form) dengan jumlah/last target bulanan.
    // Target Tahun = field `target`; monthly_target hanya untuk skor per bulan.

    // Bulan yang berubah (dan terbuka) → hapus flag submitted agar bisa diajukan ulang
    const changedOpen = [];
    for (const m of REALISASI_MONTHS || []) {
      if (closedSet.has(m)) continue;
      if (allowedMonths && !allowedMonths.includes(m)) continue;
      const mdChanged = String(prevMd[m] ?? '') !== String(mergedMonthly[m] ?? '');
      const mtChanged = String(prevMt[m] ?? '') !== String(mergedTarget[m] ?? '');
      if (mdChanged || mtChanged) changedOpen.push(m);
    }

    let ms = existing.monthly_submitted;
    if (typeof ms === 'string') {
      try { ms = JSON.parse(ms); } catch { ms = {}; }
    }
    if (!ms || typeof ms !== 'object' || Array.isArray(ms)) ms = {};
    for (const m of changedOpen) delete ms[m];

    const st = String(existing.status || '').toLowerCase();
    const wasLocked = !!(existing.is_locked || st === 'approved');
    const reopen = changedOpen.length > 0 && wasLocked;
    const nextStatus = reopen ? 'Draft' : (existing.status || 'Draft');
    const nextLocked = reopen ? 0 : (existing.is_locked ? 1 : 0);

    await db.query(
      'UPDATE kpis SET monthly_data = ?, monthly_target = ?, actual = ?, monthly_submitted = ?, status = ?, is_locked = ? WHERE id = ?',
      [
        JSON.stringify(mergedMonthly),
        JSON.stringify(mergedTarget),
        actual,
        JSON.stringify(ms),
        nextStatus,
        nextLocked,
        id,
      ]
    );

    // Log successful save for verification
    console.log(`✓ KPI Realisasi saved successfully: ID=${id}, User=${req.user.name || req.user.id}, Actual=${actual}`);

    try { await reaggregateIfChildOrMaster(db, id); } catch (e) { console.warn('master reaggregate after realisasi:', e.message); }

    // KPI Unit mengikuti Individu pemimpin (salin R/T/actual)
    try {
      const mirrored = await mirrorIndividuPemimpinToUnit(db, existing, {
        monthly_data: mergedMonthly,
        monthly_target: mergedTarget,
        actual,
      });
      if (mirrored) console.log(`✓ Mirrored Individu→Unit: ${mirrored} row(s) for ${existing.name}`);
    } catch (e) {
      console.warn('mirror individu→unit after realisasi:', e.message);
    }

    const [updated] = await db.query('SELECT * FROM kpis WHERE id = ?', [id]);
    const result = parseKpiJsonFields(updated[0]);
    
    // Add success flag to response for client-side confirmation
    res.json({ ...result, _saved: true, _message: 'Data berhasil disimpan' });
  } catch (error) {
    console.error('Update KPI realisasi error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

/**
 * Edit dari katalog Master KPI: baris katalog mewakili semua KPI bernama sama (per perspektif),
 * jadi setiap field yang diubah diterapkan ke seluruh KPI tsb. Field yang tidak diubah dibiarkan
 * per-KPI; target, realisasi, indeks, unit & pemilik tidak pernah disentuh.
 */
async function updateCatalogGroup(req, existing, kpi) {
  const where = [
    "COALESCE(unit_type, '') <> 'master'",
    'LOWER(TRIM(name)) = LOWER(TRIM(?))',
    "LOWER(TRIM(COALESCE(perspective, ''))) = LOWER(TRIM(COALESCE(?, '')))",
  ];
  const params = [existing.name, existing.perspective];
  if (req.user.role === 'user') {
    where.push('unit_name = ?', "COALESCE(is_locked, 0) = 0", "COALESCE(status, '') <> 'Approved'");
    params.push(req.user.unit_name || '');
  }
  const whereSql = where.join(' AND ');
  const [rows] = await db.query(`SELECT id, kpi_code, parent_kpi_id, unit_name, jabatan, unit_type, description, weight, target FROM kpis WHERE ${whereSql}`, params);
  if (!rows.length) return { updated: 0 };

  // Nilai acuan = yang ditampilkan katalog (agregat sama dengan GET /catalog).
  const [[base]] = await db.query(
    `SELECT MIN(name) AS name, MIN(perspective) AS perspective, MAX(unit) AS unit, MAX(polarity) AS polarity,
       MAX(description) AS description, MAX(formula) AS formula, MAX(objective) AS objective, MAX(weight) AS weight
     FROM kpis WHERE ${whereSql}`,
    params
  );

  const str = (v) => String(v ?? '').trim();
  const PARENT_SUFFIX = /\n?\(KPI Induk:.*?\)\s*$/s;
  const plainDesc = (v) => str(v).replace(PARENT_SUFFIX, '').trim();
  const changes = {};
  if (str(kpi.name) !== str(base.name)) changes.name = kpi.name;
  if (str(kpi.perspective) !== str(base.perspective)) changes.perspective = kpi.perspective;
  if ((str(kpi.polarity) || 'maximize') !== (str(base.polarity) || 'maximize')) changes.polarity = kpi.polarity || 'maximize';
  if (str(kpi.unit) !== str(base.unit)) changes.unit = str(kpi.unit) || normalizeUnit(kpi.unit);
  for (const f of ['formula', 'objective']) {
    if (str(kpi[f]) !== str(base[f])) changes[f] = str(kpi[f]) || null;
  }
  const newWeight = parseFloat(kpi.weight);
  // Bobot katalog berlaku seragam: simpan juga menyamakan KPI yang bobotnya masih berbeda.
  if (Number.isFinite(newWeight) && rows.some((r) => Math.abs(newWeight - (parseFloat(r.weight) || 0)) > 1e-9)) changes.weight = newWeight;
  // Target katalog = target tahunan semua KPI bernama sama; kosong = tidak diubah. Target bulanan tidak disentuh.
  const rawTarget = str(kpi.target).replace(',', '.');
  if (rawTarget !== '' && ['superadmin', 'admin'].includes(req.user.role)) {
    const newTarget = Number(rawTarget);
    if (!Number.isFinite(newTarget)) {
      const err = new Error('Target harus berupa angka');
      err.status = 400;
      throw err;
    }
    if (rows.some((r) => {
      const cur = parseFloat(r.target);
      return !Number.isFinite(cur) || Math.abs(newTarget - cur) > 1e-9;
    })) changes.target = String(newTarget);
  }
  const newDesc = plainDesc(kpi.description);
  const descChanged = newDesc !== plainDesc(base.description);

  const fields = Object.keys(changes);
  if (descChanged) fields.push('description');
  const requestedStatus = String(kpi.status || '').trim().toLowerCase();
  const masterStatus = ['superadmin', 'admin'].includes(req.user.role) && (requestedStatus === 'draft' || requestedStatus === 'approved' || requestedStatus === 'aktif')
    ? (requestedStatus === 'draft' ? 'Draft' : 'Approved')
    : null;

  async function applyMasterStatus() {
    if (!masterStatus) return false;
    const codes = [...new Set(rows.map((r) => r.kpi_code || r.parent_kpi_id).filter(Boolean))];
    const name = changes.name || base.name;
    const perspective = changes.perspective !== undefined ? changes.perspective : base.perspective;
    const [current] = await db.query(
      `SELECT id, status FROM kpis
       WHERE COALESCE(unit_type,'') = 'master'
         AND (
           id IN (${codes.length ? codes.map(() => '?').join(',') : 'NULL'})
           OR (
             LOWER(TRIM(name)) IN (LOWER(TRIM(?)), LOWER(TRIM(?)))
             AND LOWER(TRIM(COALESCE(perspective,''))) = LOWER(TRIM(COALESCE(?,'')))
           )
         )`,
      [...codes, name, existing.name, perspective || '']
    );
    const changed = current.some((r) => String(r.status || '') !== masterStatus);
    let affected = 0;
    if (codes.length) {
      const [byCode] = await db.query(
        "UPDATE kpis SET status = ? WHERE COALESCE(unit_type,'') = 'master' AND id IN (?)",
        [masterStatus, codes]
      );
      affected += byCode.affectedRows || 0;
    }
    const [byName] = await db.query(
      `UPDATE kpis SET status = ?
       WHERE COALESCE(unit_type,'') = 'master'
         AND LOWER(TRIM(name)) IN (LOWER(TRIM(?)), LOWER(TRIM(?)))
         AND LOWER(TRIM(COALESCE(perspective,''))) = LOWER(TRIM(COALESCE(?,'')))`,
      [masterStatus, name, existing.name, perspective || '']
    );
    affected += byName.affectedRows || 0;
    return changed || affected > 0;
  }

  if (!fields.length) {
    const statusChanged = await applyMasterStatus();
    if (!statusChanged) return { updated: 0, total: rows.length };
    return { updated: 0, total: rows.length, fields: ['status'], masterStatus };
  }

  const ids = rows.map((r) => r.id);
  const idSet = new Set(ids);
  if (changes.name) {
    const key = normalizeKpiNameKey(changes.name);
    const owners = new Set(rows.map((r) => `${r.unit_name}||${r.jabatan}||${String(r.unit_type || 'pegawai').toLowerCase()}`));
    const [same] = await db.query(
      'SELECT id, name, unit_name, jabatan, unit_type FROM kpis WHERE LOWER(TRIM(name)) LIKE ?',
      [`%${key}%`]
    );
    const dup = same.find(
      (r) =>
        !idSet.has(r.id) &&
        normalizeKpiNameKey(r.name) === key &&
        owners.has(`${r.unit_name}||${r.jabatan}||${String(r.unit_type || 'pegawai').toLowerCase()}`)
    );
    if (dup) {
      const err = new Error(`Nama KPI "${changes.name}" sudah ada untuk jabatan "${dup.jabatan}" di unit "${dup.unit_name}". Gunakan nama lain.`);
      err.status = 409;
      throw err;
    }
  }

  try {
    if (changes.objective) await ensureObjectiveRow(db, { name: changes.objective, perspective: changes.perspective || base.perspective });
    if (changes.name) {
      await ensureStrategyRow(db, {
        name: changes.name,
        perspective: changes.perspective || base.perspective,
        unit: changes.unit || base.unit,
        description: descChanged ? newDesc : plainDesc(base.description),
        formula: changes.formula !== undefined ? changes.formula : base.formula,
        objectiveName: changes.objective !== undefined ? changes.objective : base.objective,
      });
    }
  } catch (e) {
    console.warn('catalog objective/strategy:', e.message);
  }

  const setFields = Object.keys(changes);
  if (setFields.length) {
    await db.query(
      `UPDATE kpis SET ${setFields.map((f) => `${f} = ?`).join(', ')} WHERE id IN (?)`,
      [...setFields.map((f) => changes[f]), ids]
    );
  }
  if (descChanged) {
    for (const r of rows) {
      const suffix = (str(r.description).match(PARENT_SUFFIX) || [''])[0].trim();
      const desc = [newDesc, suffix].filter(Boolean).join('\n') || null;
      await db.query('UPDATE kpis SET description = ? WHERE id = ?', [desc, r.id]);
    }
  }

  if (changes.name || changes.perspective) {
    try {
      const oldCodes = new Set(rows.map((r) => r.kpi_code || r.parent_kpi_id).filter(Boolean));
      const code = await ensureMasterCodeForKpi(db, {
        name: changes.name || base.name,
        perspective: changes.perspective || base.perspective,
        unit: changes.unit || base.unit,
        polarity: changes.polarity || base.polarity,
      });
      await db.query('UPDATE kpis SET kpi_code = ?, parent_kpi_id = ? WHERE id IN (?)', [code || null, code || null, ids]);
      if (code) oldCodes.add(code);
      for (const c of oldCodes) await aggregateMasterFromChildren(db, c);
    } catch (e) {
      console.warn('master sync after catalog update:', e.message);
    }
  } else if (changes.unit) {
    try {
      const codes = [...new Set(rows.map((r) => r.kpi_code || r.parent_kpi_id).filter(Boolean))];
      const unit = normalizeUnit(changes.unit);
      for (const c of codes) {
        await db.query('UPDATE master_kpis SET unit = ? WHERE code = ?', [unit, c]).catch(() => null);
        await db.query("UPDATE kpis SET unit = ? WHERE id = ? AND COALESCE(unit_type,'') = 'master'", [unit, c]).catch(() => null);
        await aggregateMasterFromChildren(db, c);
      }
    } catch (e) {
      console.warn('master sync after catalog unit update:', e.message);
    }
  } else if (changes.target !== undefined) {
    try {
      const codes = new Set(rows.map((r) => r.kpi_code || r.parent_kpi_id).filter(Boolean));
      for (const c of codes) await aggregateMasterFromChildren(db, c);
    } catch (e) {
      console.warn('master sync after catalog target update:', e.message);
    }
  }

  const statusChanged = await applyMasterStatus();
  if (statusChanged && !fields.includes('status')) fields.push('status');
  return { updated: ids.length, total: rows.length, fields, masterStatus: statusChanged ? masterStatus : null };
}

router.put('/:id', authenticateToken, authorizeRole('superadmin', 'admin', 'user'), auditMiddleware('UPDATE_KPI'), async (req, res) => {
  try {
    const { id } = req.params;
    let kpi = normalizeKpiWritePayload(req.body || {});

    if (!kpi.name) {
      return res.status(400).json({ message: 'Nama KPI wajib diisi' });
    }

    const [existingRows] = await db.query(
      'SELECT id, name, perspective, kpi_code, parent_kpi_id, unit_type, unit_name, jabatan, status, is_locked, pic, monthly_data, monthly_target FROM kpis WHERE id = ?',
      [id]
    );
    if (!existingRows.length) {
      return res.status(404).json({ message: 'KPI tidak ditemukan' });
    }
    const existingForUpdate = existingRows[0];

    const body = req.body || {};
    if (body._catalog) {
      if (isMasterKpiId(id) || existingForUpdate.unit_type === 'master') {
        return res.status(400).json({ message: 'KPI master tidak boleh diubah manual. Gunakan reaggregate.' });
      }
      const result = await updateCatalogGroup(req, existingForUpdate, kpi);
      const [updatedRows] = await db.query('SELECT * FROM kpis WHERE id = ?', [id]);
      return res.json({ ...parseKpiJsonFields(updatedRows[0] || existingForUpdate), _catalog_updated: result.updated, _catalog_fields: result.fields || [], _master_status: result.masterStatus || null });
    }
    if (body.monthly_data === undefined) kpi.monthly_data = parseKpiJsonFields(existingForUpdate).monthly_data;
    if (body.monthly_target === undefined) kpi.monthly_target = parseKpiJsonFields(existingForUpdate).monthly_target;
    // Form katalog/master tidak membawa unit & jabatan; jangan cabut KPI pegawai dari pemiliknya.
    if (existingForUpdate.unit_type === 'pegawai' && !String(body.unit_name || '').trim()) {
      kpi.unit_name = existingForUpdate.unit_name;
      kpi.jabatan = existingForUpdate.jabatan;
      kpi.unit_type = 'pegawai';
      if (!kpi.pic) kpi.pic = existingForUpdate.pic;
    }

    // Pegawai hanya boleh mengedit KPI jabatan/unit sendiri
    if (req.user.role === 'user') {
      if (
        req.user.jabatan !== existingForUpdate.jabatan ||
        req.user.unit_name !== existingForUpdate.unit_name
      ) {
        return res.status(403).json({ message: 'Anda hanya bisa mengedit KPI Anda sendiri' });
      }
      if (existingForUpdate.is_locked || String(existingForUpdate.status || '') === 'Approved') {
        return res.status(400).json({ message: 'KPI terkunci/Approved tidak dapat diedit' });
      }
      kpi.jabatan = req.user.jabatan;
      kpi.unit_name = req.user.unit_name;
      kpi.unit_type = existingForUpdate.unit_type || 'pegawai';
      kpi.status = existingForUpdate.status || 'Draft';
    }

    if (!kpi.unit_name) kpi.unit_name = '-';
    if (!kpi.jabatan) kpi.jabatan = kpi.unit_name || '-';

    try {
      if (kpi.objective) {
        await ensureObjectiveRow(db, { name: kpi.objective, perspective: kpi.perspective });
      }
      const strat = await ensureStrategyRow(db, {
        name: kpi.name,
        perspective: kpi.perspective,
        unit: kpi.unit,
        description: kpi.description,
        formula: kpi.formula,
        objectiveName: kpi.objective,
      });
      if (strat?.id && !kpi.strategy_id) kpi.strategy_id = strat.id;
    } catch (e) {
      console.warn('ensure objective/strategy on update:', e.message);
    }

    const nextType = kpi.unit_type || existingForUpdate.unit_type || 'pegawai';
    const nameOwnerUnchanged =
      normalizeKpiNameKey(kpi.name) === normalizeKpiNameKey(existingForUpdate.name) &&
      String(kpi.unit_name || '') === String(existingForUpdate.unit_name || '') &&
      String(kpi.jabatan || '') === String(existingForUpdate.jabatan || '') &&
      String(nextType).toLowerCase() === String(existingForUpdate.unit_type || 'pegawai').toLowerCase();
    if (!nameOwnerUnchanged) {
      await assertUniqueKpiName(db, {
        name: kpi.name,
        unit_name: kpi.unit_name,
        jabatan: kpi.jabatan,
        excludeId: id,
        unit_type: nextType,
      });
    }

    if (isMasterKpiId(id) || existingForUpdate?.unit_type === 'master') {
      return res.status(400).json({ message: 'KPI master tidak boleh diubah manual. Gunakan reaggregate.' });
    }

    const masterCode = await ensureMasterCodeForKpi(db, {
      name: kpi.name,
      perspective: kpi.perspective,
      unit: kpi.unit,
      polarity: kpi.polarity,
    });
    // Hormati label satuan dari form; master hanya fallback jika kosong.
    kpi.unit = String(kpi.unit || '').trim() || (await getMasterUnit(db, masterCode)) || 'percentage';

    await ensureKpiFormColumns(db);
    await db.query(
      'UPDATE kpis SET name=?, perspective=?, unit=?, polarity=?, target=?, actual=?, weight=?, unit_name=?, jabatan=?, strategy_id=?, manual_indeks=?, monthly_data=?, monthly_target=?, status=?, unit_type=?, description=?, formula=?, objective=?, parent_kpi_id=?, parent_kpi_manual=?, pic=?, kpi_code=? WHERE id=?',
      [
        kpi.name, kpi.perspective, kpi.unit, kpi.polarity || 'maximize', kpi.target, kpi.actual, kpi.weight,
        kpi.unit_name, kpi.jabatan, kpi.strategy_id || null,
        kpi.manual_indeks,
        JSON.stringify(kpi.monthly_data || {}),
        JSON.stringify(kpi.monthly_target || {}),
        kpi.status || 'Draft', kpi.unit_type || 'pegawai',
        kpi.description || null, kpi.formula || null, kpi.objective || null,
        masterCode, kpi.parent_kpi_manual || null, kpi.pic || null, masterCode, id
      ]
    );

    try {
      await syncChildMasterLink(db, { id, name: kpi.name, kpi_code: masterCode, parent_kpi_id: masterCode });
      if (existingForUpdate?.kpi_code && existingForUpdate.kpi_code !== masterCode) {
        await aggregateMasterFromChildren(db, existingForUpdate.kpi_code);
      }
    } catch (e) {
      console.warn('master sync after update:', e.message);
    }

    try {
      await mirrorIndividuPemimpinToUnit(db, {
        ...existingForUpdate,
        ...kpi,
        unit_type: kpi.unit_type || existingForUpdate.unit_type || 'pegawai',
      }, {
        monthly_data: kpi.monthly_data,
        monthly_target: kpi.monthly_target,
        actual: kpi.actual,
        weight: kpi.weight,
        polarity: kpi.polarity,
        unit: kpi.unit,
        target: kpi.target,
        perspective: kpi.perspective,
        manual_indeks: kpi.manual_indeks,
      });
    } catch (e) {
      console.warn('mirror individu→unit after update:', e.message);
    }

    const [updatedKpis] = await db.query('SELECT * FROM kpis WHERE id = ?', [id]);
    if (updatedKpis.length === 0) {
      return res.status(404).json({ message: 'KPI tidak ditemukan' });
    }
    res.json(parseKpiJsonFields(updatedKpis[0]));
  } catch (error) {
    console.error('Update KPI error:', error.message);
    if (error.status === 409 || error.status === 400) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.delete('/by-jabatan', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('DELETE_KPI_BY_JABATAN'), async (req, res) => {
  try {
    const { jabatan, unit_name } = req.query;
    if (!jabatan || !unit_name) {
      return res.status(400).json({ message: 'jabatan dan unit_name diperlukan' });
    }

    const scope = await buildJabatanUnitScope(db, jabatan, unit_name);

    const [lockedRows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM kpis WHERE ${scope.where} AND (is_locked = 1 OR status = 'Approved')`,
      scope.params
    );
    if (lockedRows[0].cnt > 0) {
      return res.status(400).json({ message: 'KPI terkunci tidak dapat dihapus. Buka kunci terlebih dahulu.' });
    }

    const [result] = await db.query(`DELETE FROM kpis WHERE ${scope.where}`, scope.params);
    res.json({ message: `${result.affectedRows} KPI berhasil dihapus`, deleted: result.affectedRows });
  } catch (error) {
    console.error('Delete KPI by jabatan error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.delete('/:id', authenticateToken, authorizeRole('superadmin', 'admin', 'user'), auditMiddleware('DELETE_KPI'), async (req, res) => {
  try {
    const { id } = req.params;
    if (isMasterKpiId(id)) {
      return res.status(400).json({ message: 'KPI master tidak boleh dihapus' });
    }

    const [rows] = await db.query(
      'SELECT kpi_code, parent_kpi_id, unit_name, jabatan, status, is_locked, unit_type FROM kpis WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'KPI tidak ditemukan' });
    }
    const existing = rows[0];

    // PROTEKSI MUTASI: Jangan izinkan penghapusan KPI yang terdaftar di Scorecard Periode Lama (sebelum mutasi)
    try {
      const [activeMuts] = await db.query(
        "SELECT id, employee_name, old_kpi_ids FROM mutation_history WHERE status = 'active'"
      );
      for (const m of activeMuts) {
        let oldIds = [];
        try {
          oldIds = Array.isArray(m.old_kpi_ids) ? m.old_kpi_ids : JSON.parse(m.old_kpi_ids || '[]');
        } catch {}
        if (oldIds.map(String).includes(String(id))) {
          return res.status(400).json({
            message: `KPI ini terdaftar pada Scorecard Periode Lama (sebelum mutasi) pegawai ${m.employee_name || ''} dan tidak dapat dihapus.`,
          });
        }
      }
    } catch (errProtect) {
      console.warn('Check mutation old_kpi_ids error:', errProtect.message);
    }

    if (req.user.role === 'user') {
      if (req.user.jabatan !== existing.jabatan || req.user.unit_name !== existing.unit_name) {
        return res.status(403).json({ message: 'Anda hanya bisa menghapus KPI Anda sendiri' });
      }
      if (existing.is_locked || String(existing.status || '') === 'Approved') {
        return res.status(400).json({ message: 'KPI terkunci/Approved tidak dapat dihapus' });
      }
      if (existing.unit_type === 'master') {
        return res.status(400).json({ message: 'KPI master tidak boleh dihapus' });
      }
    }

    const code = existing.kpi_code || existing.parent_kpi_id;

    await db.query('DELETE FROM kpis WHERE id = ?', [id]);

    // Jika KPI ini ada di new_kpi_ids mutasi aktif, sinkronkan array-nya agar tidak ada ID menggantung
    try {
      const [activeMuts] = await db.query(
        "SELECT id, new_kpi_ids FROM mutation_history WHERE status = 'active'"
      );
      for (const m of activeMuts) {
        let newIds = [];
        try {
          newIds = Array.isArray(m.new_kpi_ids) ? m.new_kpi_ids : JSON.parse(m.new_kpi_ids || '[]');
        } catch {}
        if (newIds.map(String).includes(String(id))) {
          const updatedNewIds = newIds.filter((x) => String(x) !== String(id));
          await db.query('UPDATE mutation_history SET new_kpi_ids = ? WHERE id = ?', [
            JSON.stringify(updatedNewIds),
            m.id,
          ]);
        }
      }
    } catch (errSync) {
      console.warn('Sync new_kpi_ids on delete error:', errSync.message);
    }

    if (code && isMasterKpiId(code)) {
      try { await aggregateMasterFromChildren(db, code); } catch (e) { console.warn('master reaggregate after delete:', e.message); }
    }

    res.json({ message: 'KPI berhasil dihapus' });
  } catch (error) {
    console.error('Delete KPI error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

function pickApprovalStatus(statuses) {
  const list = (statuses || []).map((s) => String(s || 'Draft'));
  const has = (re) => list.some((s) => re.test(s));
  if (has(/^(submitted|menunggu|pending)$/i)) return 'Submitted';
  if (has(/^approved$/i)) return 'Approved';
  if (has(/^rejected$/i)) return 'Rejected';
  return list[0] || 'Draft';
}

async function assertCanManageApproval(dbConn, user, jabatan, unitName) {
  if (['superadmin', 'admin'].includes(user.role)) return true;
  const [allowed] = await dbConn.query(
    `SELECT 1 AS ok FROM users
     WHERE jabatan = ? AND unit_name = ?
       AND (supervisi_approval = ? OR supervisi_approval = ?)
     LIMIT 1`,
    [jabatan, unitName, user.name, user.npp || user.name]
  );
  if (!allowed.length) {
    const err = new Error('Anda tidak berhak mengelola pengajuan KPI ini');
    err.status = 403;
    throw err;
  }
  return true;
}

router.post('/submit', authenticateToken, auditMiddleware('SUBMIT_KPI'), async (req, res) => {
  try {
    const { jabatan, unit_name, month_key: monthKey } = req.body;
    const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    const month = MONTHS.includes(monthKey) ? monthKey : null;

    if (!jabatan || !unit_name) {
      return res.status(400).json({ message: 'Jabatan dan unit_name diperlukan' });
    }

    if (req.user.role === 'user' && (req.user.jabatan !== jabatan || req.user.unit_name !== unit_name)) {
      return res.status(403).json({ message: 'Anda hanya bisa submit KPI Anda sendiri' });
    }

    await ensureKpiFormColumns(db);
    const scope = await buildJabatanUnitScope(db, jabatan, unit_name);

    const [rows] = await db.query(
      `SELECT id, weight, status, is_locked, monthly_submitted FROM kpis WHERE ${scope.where}`,
      scope.params
    );
    if (!rows.length) {
      return res.status(400).json({ message: 'Tidak ada KPI untuk diajukan' });
    }
    if (rows.some((r) => r.is_locked || String(r.status || '').toLowerCase() === 'approved')) {
      return res.status(400).json({ message: 'KPI sudah disetujui/terkunci. Minta atasan/admin membuka kunci sebelum mengajukan ulang.' });
    }

    // Periode (bulan) sudah diajukan → tolak ajuan ulang sampai di-approve/unlock
    if (month) {
      const already = rows.some((r) => {
        let ms = r.monthly_submitted;
        if (typeof ms === 'string') {
          try { ms = JSON.parse(ms); } catch { ms = {}; }
        }
        return ms && typeof ms === 'object' && !!ms[month];
      });
      if (already) {
        return res.status(400).json({
          message: `Periode ${month} sudah diajukan dan menunggu approval. Tombol Ajukan dinonaktifkan.`,
          month_key: month,
        });
      }
    }

    const totalBobot = Math.round(rows.reduce((s, r) => s + (parseFloat(r.weight) || 0), 0) * 100) / 100;
    if (Math.abs(totalBobot - 100) > 0.1) {
      return res.status(400).json({
        message: `Total bobot KPI harus 100%. Saat ini ${totalBobot}%. Tombol Ajukan tidak dapat diproses.`,
        total_bobot: totalBobot,
      });
    }

    // Tandai pengajuan per periode + status Submitted
    for (const row of rows) {
      let ms = row.monthly_submitted;
      if (typeof ms === 'string') {
        try { ms = JSON.parse(ms); } catch { ms = {}; }
      }
      if (!ms || typeof ms !== 'object' || Array.isArray(ms)) ms = {};
      if (month) ms[month] = new Date().toISOString();
      await db.query(
        'UPDATE kpis SET status = ?, approved_by = NULL, approved_at = NOW(), monthly_submitted = ? WHERE id = ?',
        ['Submitted', JSON.stringify(ms), row.id]
      );
    }

    res.json({
      message: month
        ? `KPI periode ${month} berhasil disubmit ke Pimpinan`
        : 'KPI berhasil disubmit ke Pimpinan',
      total_bobot: totalBobot,
      month_key: month,
    });
  } catch (error) {
    console.error('Submit KPI error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/approval-list', authenticateToken, async (req, res) => {
  try {
    const pimpinanName = req.user.name;
    const role = req.user.role;

    let subordinates = [];
    const unitNameQuery = req.query.unit_name;
    const jabatanQuery = req.query.jabatan;
    // Admin & superadmin melihat semua pengajuan workflow; pimpinan lain hanya bawahan langsung
    const seeAllPending = role === 'superadmin' || role === 'admin';

    if (seeAllPending) {
      let queryStr = 'SELECT name, npp, jabatan, unit_name, supervisi_approval FROM users WHERE role != "superadmin"';
      let queryParams = [];

      if (unitNameQuery && unitNameQuery !== 'All') {
        queryStr += ' AND unit_name = ?';
        queryParams.push(unitNameQuery);
      }

      if (jabatanQuery && jabatanQuery !== 'All') {
        queryStr += ' AND jabatan = ?';
        queryParams.push(jabatanQuery);
      }

      // Tanpa filter unit/jabatan: hanya user yang punya KPI di alur approval
      if (!unitNameQuery && !jabatanQuery) {
        queryStr += ` AND (jabatan, unit_name) IN (
          SELECT DISTINCT jabatan, unit_name FROM kpis
          WHERE status IN ('Submitted','submitted','Menunggu','Pending','Approved','approved','Rejected','rejected')
        )`;
      }

      const [allSubs] = await db.query(queryStr, queryParams);
      subordinates = allSubs;
    } else {
      const [directSubordinates] = await db.query(
        'SELECT name, npp, jabatan, unit_name, supervisi_approval FROM users WHERE supervisi_approval = ? OR supervisi_approval = ?',
        [pimpinanName, req.user.npp || pimpinanName]
      );
      subordinates = directSubordinates;
    }

    if (subordinates.length === 0) {
      return res.json([]);
    }

    const jabatanUnitPairs = subordinates.map(s => [s.jabatan, s.unit_name]).filter(([j, u]) => j && u);

    if (jabatanUnitPairs.length === 0) {
      return res.json([]);
    }

    const placeholders = jabatanUnitPairs.map(() => '(jabatan = ? AND unit_name = ?)').join(' OR ');
    const queryParams = jabatanUnitPairs.flat();

    const [kpiRows] = await db.query(
      `SELECT status, actual, target, weight, manual_indeks, jabatan, unit_name, unit, monthly_data, monthly_target, approved_at, created_at FROM kpis WHERE ${placeholders}`,
      queryParams
    );

    const kpisMap = {};
    for (const row of kpiRows) {
      const key = `${row.jabatan}_${row.unit_name}`;
      if (!kpisMap[key]) kpisMap[key] = [];
      kpisMap[key].push(row);
    }

    const results = [];
    for (const sub of subordinates) {
      const key = `${sub.jabatan}_${sub.unit_name}`;
      const kpis = kpisMap[key] || [];

      if (kpis.length > 0) {
        const status = pickApprovalStatus(kpis.map((k) => k.status));
        let totalBobot = 0;
        let totalHasil = 0;
        let submittedAt = null;

        kpis.forEach(kpi => {
          const { hasil } = computeKpiYtdScores(kpi);
          const weight = parseFloat(kpi.weight) || 0;
          totalBobot += weight;
          totalHasil += hasil;
          const ts = kpi.approved_at || kpi.created_at;
          if (ts && (!submittedAt || new Date(ts) > new Date(submittedAt))) {
            submittedAt = ts;
          }
        });

        results.push({
          ...sub,
          status,
          submitted_at: submittedAt,
          total_kpi: kpis.length,
          total_bobot: totalBobot,
          total_hasil: totalHasil
        });
      } else {
        results.push({
          ...sub,
          status: 'Belum Ada KPI',
          submitted_at: null,
          total_kpi: 0,
          total_bobot: 0,
          total_hasil: 0
        });
      }
    }

    // Tab "Menunggu" hanya relevan untuk yang sudah diajukan / diputuskan
    res.json(results.filter((r) => r.status !== 'Belum Ada KPI' && r.status !== 'Draft'));
  } catch (error) {
    console.error('Approval list error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

/** Detail perubahan KPI per jabatan+unit untuk dialog Approval */
router.get('/approval-detail', authenticateToken, async (req, res) => {
  try {
    const jabatan = (req.query.jabatan || '').trim();
    const unitName = (req.query.unit_name || '').trim();
    if (!jabatan || !unitName) {
      return res.status(400).json({ message: 'jabatan dan unit_name wajib diisi' });
    }

    const role = req.user.role;
    if (role !== 'superadmin' && role !== 'admin') {
      const [allowed] = await db.query(
        `SELECT 1 AS ok FROM users
         WHERE jabatan = ? AND unit_name = ?
           AND (supervisi_approval = ? OR supervisi_approval = ?)
         LIMIT 1`,
        [jabatan, unitName, req.user.name, req.user.npp || req.user.name]
      );
      if (!allowed.length) {
        return res.status(403).json({ message: 'Anda tidak berhak melihat pengajuan ini' });
      }
    }

    // Hindari kolom opsional (notes/monthly_submitted) yang belum tentu ada di semua DB.
    await ensureKpiFormColumns(db);
    const [rows] = await db.query(
      `SELECT id, name, perspective, unit, polarity, weight, target, actual, status,
              monthly_data, monthly_target, approved_at, created_at, unit_name, jabatan
       FROM kpis
       WHERE jabatan = ? AND unit_name = ? AND COALESCE(unit_type, '') <> 'master'
       ORDER BY perspective, name`,
      [jabatan, unitName]
    );

    const items = rows.map((row) => {
      const kpi = parseKpiJsonFields(row);
      try {
        const { pencapaian, hasil, indeks } = computeKpiYtdScores(kpi);
        return { ...kpi, pencapaian, hasil, indeks };
      } catch (e) {
        console.warn('approval-detail score', row.id, e.message);
        return { ...kpi, pencapaian: 0, hasil: 0, indeks: 0 };
      }
    });

    res.json(items);
  } catch (error) {
    console.error('Approval detail error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/approve', authenticateToken, auditMiddleware('APPROVE_KPI'), async (req, res) => {
  try {
    const { jabatan, unit_name, action } = req.body;

    if (!jabatan || !unit_name || !action) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    await assertCanManageApproval(db, req.user, jabatan, unit_name);

    const newStatus = action === 'Approve' ? 'Approved' : 'Rejected';
    const scope = await buildJabatanUnitScope(db, jabatan, unit_name);

    if (action === 'Approve') {
      // Setelah approved, data otomatis terkunci (hanya atasan/admin yang bisa unlock).
      await db.query(
        `UPDATE kpis SET status = ?, is_locked = TRUE, approved_by = ?, approved_at = NOW() WHERE ${scope.where}`,
        [newStatus, req.user.name, ...scope.params]
      );
    } else {
      await ensureKpiFormColumns(db);
      await db.query(
        `UPDATE kpis SET status = ?, is_locked = FALSE, approved_by = ?, approved_at = NOW(), monthly_submitted = ? WHERE ${scope.where}`,
        [newStatus, req.user.name, JSON.stringify({}), ...scope.params]
      );
    }

    res.json({
      message: action === 'Approve'
        ? 'KPI disetujui dan dikunci otomatis'
        : `KPI berhasil di ${newStatus}`,
    });
  } catch (error) {
    console.error('Approve KPI error:', error.message);
    res.status(error.status || 500).json({ message: error.message || 'Terjadi kesalahan pada server' });
  }
});

router.post('/lock', authenticateToken, auditMiddleware('LOCK_KPI'), async (req, res) => {
  try {
    const { jabatan, unit_name } = req.body;

    if (!jabatan || !unit_name) {
      return res.status(400).json({ message: 'Jabatan dan Unit Name diperlukan' });
    }

    await assertCanManageApproval(db, req.user, jabatan, unit_name);

    const scope = await buildJabatanUnitScope(db, jabatan, unit_name);
    await db.query(
      `UPDATE kpis SET is_locked = TRUE, status = ? WHERE ${scope.where}`,
      ['Approved', ...scope.params]
    );

    res.json({ message: 'KPI berhasil dikunci.' });
  } catch (error) {
    console.error('Lock KPI error:', error.message);
    res.status(error.status || 500).json({ message: error.message || 'Terjadi kesalahan pada server' });
  }
});

router.post('/unlock', authenticateToken, auditMiddleware('UNLOCK_KPI'), async (req, res) => {
  try {
    const { jabatan, unit_name } = req.body;

    if (!jabatan || !unit_name) {
      return res.status(400).json({ message: 'Jabatan dan Unit Name diperlukan' });
    }

    // Hanya atasan (supervisi) / admin / superadmin yang boleh membuka kunci.
    await assertCanManageApproval(db, req.user, jabatan, unit_name);

    const scope = await buildJabatanUnitScope(db, jabatan, unit_name);
    await ensureKpiFormColumns(db);
    await db.query(
      `UPDATE kpis SET is_locked = FALSE, status = ?, monthly_submitted = ? WHERE ${scope.where}`,
      ['Draft', JSON.stringify({}), ...scope.params]
    );

    res.json({ message: 'KPI berhasil dibuka kuncinya. Pegawai dapat mengedit dan mengajukan ulang.' });
  } catch (error) {
    console.error('Unlock KPI error:', error.message);
    res.status(error.status || 500).json({ message: error.message || 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
