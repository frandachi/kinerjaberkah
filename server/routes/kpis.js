const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorize');
const { auditMiddleware, logActivity } = require('../middleware/audit');
const { getGapSummary, getGapList, inferLevelUnit } = require('../lib/kpi-gap-utils');
const { buildKpiRecords, getTemplateKpis } = require('../lib/kpi-template-engine');
const { computeKpiYtdScores, computeYtdActual, normalizeUnit } = require('../lib/kpi-scoring');
const { buildJabatanUnitScope } = require('../lib/kpi-scope');
const {
  mergeMonthlyDataRespectingLock,
  mergeMonthlyTarget,
  parseLockedMonths,
  getMutationAllowedMonths,
} = require('../lib/kpi-realisasi-lock');
const {
  setupMasterKpiFin01,
  setupAllMasterKpis,
  ensureMasterCodeForKpi,
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
const {
  normSpace,
  normalizeJabatan,
  namesSimilar,
  buildPegawaiIndex,
  matchPegawai,
  sanitizeKpi,
  currentMonthIndexWib,
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
  out.unit = String(out.unit || '%').trim() || '%';
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
  out.manual_indeks = indeks === null || indeks === '' ? null : indeks;
  return out;
}

let kpiFormColsReady = false;
async function ensureKpiFormColumns(connection) {
  if (kpiFormColsReady) return;
  const cols = [
    ['parent_kpi_manual', 'VARCHAR(255) NULL'],
    ['pic', 'VARCHAR(255) NULL'],
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

/** Cek nama KPI unik dalam 1 unit + jabatan (case-insensitive, abaikan prefix sub-KPI "-") */
async function assertUniqueKpiName(dbConn, { name, unit_name, jabatan, excludeId = null }) {
  const key = normalizeKpiNameKey(name);
  if (!key || !unit_name || !jabatan) return;

  const [rows] = await dbConn.query(
    'SELECT id, name FROM kpis WHERE unit_name = ? AND jabatan = ?',
    [unit_name, jabatan]
  );
  const dup = rows.find(
    (r) => normalizeKpiNameKey(r.name) === key && (!excludeId || r.id !== excludeId)
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
  if (s <= 100) return 'Baik';
  if (s <= 110) return 'Baik Sekali';
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
    };
  }

  let scoredWeight = 0;
  let weightedPencapaian = 0;
  let kpiTercapai = 0;
  let scoredCount = 0;

  kpis.forEach((kpi) => {
    const weight = parseFloat(kpi.weight) || 0;
    const { pencapaian } = computeKpiYtdScores(kpi);
    const md = typeof kpi.monthly_data === 'string'
      ? (() => { try { return JSON.parse(kpi.monthly_data); } catch { return {}; } })()
      : (kpi.monthly_data || {});
    const hasData = Object.values(md).some((v) => v !== undefined && v !== null && v !== '' && Number(v) !== 0);

    if (hasData || pencapaian > 0) {
      const w = weight > 0 ? weight : 1;
      scoredWeight += w;
      weightedPencapaian += w * Math.min(pencapaian, 120);
      scoredCount += 1;
      if (pencapaian >= 100) kpiTercapai += 1;
    }
  });

  const pencapaianTotal = scoredWeight > 0 ? weightedPencapaian / scoredWeight : 0;
  const kpiTotal = kpis.length;

  return {
    skorTotal: pencapaianTotal,
    pencapaianTotal,
    kpiTercapai,
    kpiTotal,
    kpiTercapaiPersen: scoredCount > 0 ? (kpiTercapai / scoredCount) * 100 : 0,
    klasifikasi: getPredikatLabel(pencapaianTotal),
    scoredCount,
    coveragePersen: kpiTotal > 0 ? Math.round((scoredCount / kpiTotal) * 100) : 0,
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
      "SELECT id, name, unit, polarity, weight, monthly_data, monthly_target, manual_indeks, unit_type, unit_name, jabatan FROM kpis WHERE COALESCE(unit_type, '') <> 'master'"
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
      const [unitKpis] = await db.query(
        `SELECT id, name, unit, polarity, weight, monthly_data, monthly_target, manual_indeks, unit_type, unit_name, jabatan
         FROM kpis WHERE unit_name = ? AND COALESCE(unit_type, '') <> 'master'`,
        [unitName]
      );
      rows = unitKpis;
    } else {
      const [allKpis] = await db.query(
        "SELECT id, name, unit, polarity, weight, monthly_data, monthly_target, manual_indeks, unit_type, unit_name, jabatan FROM kpis WHERE COALESCE(unit_type, '') <> 'master'"
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
    const where = ["COALESCE(unit_type, '') <> 'master'"];
    const params = [];
    if (search) {
      where.push('(name LIKE ? OR objective LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (perspective && perspective !== 'all') {
      where.push('perspective = ?');
      params.push(perspective);
    }
    if (req.user.role === 'user') {
      where.push('unit_name = ?');
      params.push(req.user.unit_name || '');
    }
    const sql = `
      SELECT MIN(id) AS id,
        MIN(name) AS name,
        MIN(perspective) AS perspective,
        MAX(unit) AS unit,
        MAX(polarity) AS polarity,
        MAX(status) AS status,
        MAX(description) AS description,
        MAX(formula) AS formula,
        MAX(objective) AS objective,
        MAX(weight) AS weight,
        MAX(NULLIF(kpi_code, '')) AS kpi_code,
        MAX(NULLIF(parent_kpi_id, '')) AS parent_kpi_id,
        COUNT(*) AS instance_count,
        COUNT(DISTINCT unit_name) AS unit_count
      FROM kpis
      WHERE ${where.join(' AND ')}
      GROUP BY LOWER(TRIM(name)), LOWER(TRIM(COALESCE(perspective, '')))
      ORDER BY MIN(name) ASC`;
    const [rows] = await db.query(sql, params);
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
    const where = ["COALESCE(unit_type, '') <> 'master'"];
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
      LIST_COLS + ', monthly_data, monthly_target, monthly_data_locked';
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
      if (req.query.scope === 'unit-office' && isPemimpinCabangJabatan(req.user.jabatan)) {
        whereClauses.push('unit_name = ?');
        queryParams.push(req.user.unit_name);
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
          whereClauses.push('((jabatan = ? AND unit_name = ?) OR (jabatan = ? AND unit_name = ?))');
          queryParams.push(req.user.jabatan, req.user.unit_name, extra.old_jabatan, extra.old_unit_name);
        } else {
          whereClauses.push('jabatan = ? AND unit_name = ?');
          queryParams.push(req.user.jabatan, req.user.unit_name);
        }
      }
    } else {
      // Admin/superadmin: honor optional filters from the client
      const unitName = String(filterUnitName || '').replace(/^\[[^\]]+\]\s*/, '').trim();
      if (unitName) {
        whereClauses.push('unit_name = ?');
        queryParams.push(unitName);
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
    });

    const id = 'kpi_' + Date.now() + Math.floor(Math.random() * 1000);
    const masterCode = await ensureMasterCodeForKpi(db, {
      name: kpi.name,
      perspective: kpi.perspective,
      unit: kpi.unit,
      polarity: kpi.polarity,
    });

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
    const maxMonthIdx = currentMonthIndexWib();
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
        base.warnings.push(`Realisasi ${droppedMonths.join(', ')} diabaikan (bulan belum berjalan); target tetap disimpan`);
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
        return { ...k, name: m.name, unit: m.unit || k.unit, polarity: m.polarity || k.polarity, kpi_code: m.code };
      });
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

    const uniqueUnitJabatans = [...new Set(kpis.map(k => `${k.unit_name}|${k.jabatan}`))];
    for (const pair of uniqueUnitJabatans) {
      const [unit_name, jabatan] = pair.split('|');
      await db.query('DELETE FROM kpis WHERE unit_name = ? AND jabatan = ?', [unit_name, jabatan]);
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

    const kpiValues = dedupedKpis.map((kpi, index) => [
      'kpi_' + Date.now() + '_' + index,
      kpi.name, kpi.perspective, kpi.unit, kpi.polarity || 'maximize', kpi.target || 0, kpi.actual || 0, kpi.weight || 0,
      kpi.unit_name, kpi.jabatan, kpi.strategy_id || null, null, JSON.stringify(kpi.monthly_data || {}),
      kpi.unit_type || null, kpi.parent_kpi_id || null, kpi.status || 'Draft',
      kpi.description || null, kpi.formula || null, kpi.objective || null
    ]);

    await db.query(
      'INSERT INTO kpis (id, name, perspective, unit, polarity, target, actual, weight, unit_name, jabatan, strategy_id, manual_indeks, monthly_data, unit_type, parent_kpi_id, status, description, formula, objective) VALUES ?',
      [kpiValues]
    );

    res.json({
      message: 'Bulk insert successful',
      inserted: dedupedKpis.length,
      skippedDuplicates: kpis.length - dedupedKpis.length,
    });
  } catch (error) {
    console.error('Bulk KPI error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
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

    // Mutasi: soft-lock — bulan di luar periode scorecard di-strip saat merge
    // (jangan 400: client sering kirim full monthly_data/target dan memicu false positive)
    const mutationMonths = await getMutationAllowedMonths(db, existing);

    const mergedMonthly = mergeMonthlyDataRespectingLock(
      existing,
      incomingMonthly || {},
      req.user.role,
      mutationMonths
    );
    const mergedTarget = incomingTarget
      ? mergeMonthlyTarget(existing, incomingTarget, mutationMonths)
      : (existing.monthly_target || {});
    const unitType = normalizeUnit(existing.unit);
    const actual = computeYtdActual(unitType, mergedMonthly);

    // Hitung target tahunan sederhana dari monthly_target bila tersedia
    const targetValues = Object.values(mergedTarget || {})
      .map((v) => parseFloat(v))
      .filter((v) => !Number.isNaN(v));
    const yearlyTarget = targetValues.length
      ? (unitType === 'percentage' || unitType === 'score'
          ? targetValues[targetValues.length - 1]
          : targetValues.reduce((a, b) => a + b, 0))
      : existing.target;

    await db.query(
      'UPDATE kpis SET monthly_data = ?, monthly_target = ?, actual = ?, target = ? WHERE id = ?',
      [JSON.stringify(mergedMonthly), JSON.stringify(mergedTarget), actual, yearlyTarget, id]
    );

    // Log successful save for verification
    console.log(`✓ KPI Realisasi saved successfully: ID=${id}, User=${req.user.name || req.user.id}, Actual=${actual}`);

    try { await reaggregateIfChildOrMaster(db, id); } catch (e) { console.warn('master reaggregate after realisasi:', e.message); }

    const [updated] = await db.query('SELECT * FROM kpis WHERE id = ?', [id]);
    const result = parseKpiJsonFields(updated[0]);
    
    // Add success flag to response for client-side confirmation
    res.json({ ...result, _saved: true, _message: 'Data berhasil disimpan' });
  } catch (error) {
    console.error('Update KPI realisasi error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.put('/:id', authenticateToken, authorizeRole('superadmin', 'admin', 'user'), auditMiddleware('UPDATE_KPI'), async (req, res) => {
  try {
    const { id } = req.params;
    let kpi = normalizeKpiWritePayload(req.body || {});

    if (!kpi.name) {
      return res.status(400).json({ message: 'Nama KPI wajib diisi' });
    }

    const [existingRows] = await db.query(
      'SELECT id, name, kpi_code, parent_kpi_id, unit_type, unit_name, jabatan, status, is_locked FROM kpis WHERE id = ?',
      [id]
    );
    if (!existingRows.length) {
      return res.status(404).json({ message: 'KPI tidak ditemukan' });
    }
    const existingForUpdate = existingRows[0];

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

    await assertUniqueKpiName(db, {
      name: kpi.name,
      unit_name: kpi.unit_name,
      jabatan: kpi.jabatan,
      excludeId: id,
    });

    if (isMasterKpiId(id) || existingForUpdate?.unit_type === 'master') {
      return res.status(400).json({ message: 'KPI master tidak boleh diubah manual. Gunakan reaggregate.' });
    }

    const masterCode = await ensureMasterCodeForKpi(db, {
      name: kpi.name,
      perspective: kpi.perspective,
      unit: kpi.unit,
      polarity: kpi.polarity,
    });

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

    const [updatedKpis] = await db.query('SELECT * FROM kpis WHERE id = ?', [id]);
    if (updatedKpis.length === 0) {
      return res.status(404).json({ message: 'KPI tidak ditemukan' });
    }
    res.json(parseKpiJsonFields(updatedKpis[0]));
  } catch (error) {
    console.error('Update KPI error:', error.message);
    if (error.status === 409) {
      return res.status(409).json({ message: error.message });
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

router.post('/submit', authenticateToken, auditMiddleware('SUBMIT_KPI'), async (req, res) => {
  try {
    const { jabatan, unit_name } = req.body;

    if (!jabatan || !unit_name) {
      return res.status(400).json({ message: 'Jabatan dan unit_name diperlukan' });
    }

    if (req.user.role === 'user' && (req.user.jabatan !== jabatan || req.user.unit_name !== unit_name)) {
      return res.status(403).json({ message: 'Anda hanya bisa submit KPI Anda sendiri' });
    }

    const scope = await buildJabatanUnitScope(db, jabatan, unit_name);
    // Tandai pengajuan; approved_at dipakai UI sebagai tanggal pengajuan bila submitted_at belum ada
    await db.query(
      `UPDATE kpis SET status = ?, approved_by = NULL, approved_at = NOW() WHERE ${scope.where}`,
      ['Submitted', ...scope.params]
    );

    res.json({ message: 'KPI berhasil disubmit ke Pimpinan' });
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

    const [rows] = await db.query(
      `SELECT id, name, perspective, unit, polarity, weight, target, actual, status,
              monthly_data, monthly_target, notes, approved_at, created_at, unit_name, jabatan
       FROM kpis
       WHERE jabatan = ? AND unit_name = ? AND COALESCE(unit_type, '') <> 'master'
       ORDER BY perspective, name`,
      [jabatan, unitName]
    );

    const items = rows.map((row) => {
      const kpi = parseKpiJsonFields(row);
      const { pencapaian, hasil, indeks } = computeKpiYtdScores(kpi);
      return { ...kpi, pencapaian, hasil, indeks };
    });

    res.json(items);
  } catch (error) {
    console.error('Approval detail error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/approve', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('APPROVE_KPI'), async (req, res) => {
  try {
    const { jabatan, unit_name, action } = req.body;

    if (!jabatan || !unit_name || !action) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    const newStatus = action === 'Approve' ? 'Approved' : 'Rejected';
    const scope = await buildJabatanUnitScope(db, jabatan, unit_name);

    await db.query(
      `UPDATE kpis SET status = ?, approved_by = ?, approved_at = NOW() WHERE ${scope.where}`,
      [newStatus, req.user.name, ...scope.params]
    );

    res.json({ message: `KPI berhasil di ${newStatus}` });
  } catch (error) {
    console.error('Approve KPI error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/lock', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('LOCK_KPI'), async (req, res) => {
  try {
    const { jabatan, unit_name } = req.body;

    if (!jabatan || !unit_name) {
      return res.status(400).json({ message: 'Jabatan dan Unit Name diperlukan' });
    }

    const scope = await buildJabatanUnitScope(db, jabatan, unit_name);
    await db.query(
      `UPDATE kpis SET is_locked = TRUE, status = ? WHERE ${scope.where}`,
      ['Approved', ...scope.params]
    );

    res.json({ message: 'KPI berhasil disimpan (dikunci).' });
  } catch (error) {
    console.error('Lock KPI error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/unlock', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('UNLOCK_KPI'), async (req, res) => {
  try {
    const { jabatan, unit_name } = req.body;

    if (!jabatan || !unit_name) {
      return res.status(400).json({ message: 'Jabatan dan Unit Name diperlukan' });
    }

    const scope = await buildJabatanUnitScope(db, jabatan, unit_name);
    await db.query(
      `UPDATE kpis SET is_locked = FALSE, status = ? WHERE ${scope.where}`,
      ['Draft', ...scope.params]
    );

    res.json({ message: 'KPI berhasil dibuka kuncinya.' });
  } catch (error) {
    console.error('Unlock KPI error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
