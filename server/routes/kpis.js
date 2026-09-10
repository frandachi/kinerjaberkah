const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorize');
const { auditMiddleware } = require('../middleware/audit');
const { getGapSummary, getGapList, inferLevelUnit } = require('../lib/kpi-gap-utils');
const { buildKpiRecords, getTemplateKpis } = require('../lib/kpi-template-engine');
const { computeKpiYtdScores, computeYtdActual, normalizeUnit } = require('../lib/kpi-scoring');
const { buildJabatanUnitScope } = require('../lib/kpi-scope');
const {
  mergeMonthlyDataRespectingLock,
  mergeMonthlyTarget,
  parseLockedMonths,
} = require('../lib/kpi-realisasi-lock');
const {
  setupMasterKpiFin01,
  setupAllMasterKpis,
  aggregateMasterFromChildren,
  syncChildMasterLink,
  reaggregateIfChildOrMaster,
  resolveMasterCodeForName,
  listMasterKpis,
  getMasterDetail,
  parseJsonField: parseMasterJsonField,
} = require('../lib/kpi-master');

function isMasterKpiId(id) {
  return typeof id === 'string' && /^KPI-[A-Z]+-\d+$/i.test(id);
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

router.get('/', authenticateToken, async (req, res) => {
  try {
    // NOTE: the built frontend (Dashboard, AllKPI, CascadingKPI, KPIIndividu,
    // KPIUnit, OKRJabatan, PerspectivePage, ...) always fetches this endpoint
    // with no page/limit params and does its own client-side filtering
    // (e.g. `kpis.filter(...)`) over the full result. It expects a bare
    // array, not a {data, pagination} envelope - returning the envelope, or
    // silently truncating to the old default LIMIT 100 (out of 15000+ rows),
    // caused "n.filter is not a function" crashes and incomplete dashboards.
    const { search = '' } = req.query;

    let queryStr = 'SELECT * FROM kpis';
    const queryParams = [];

    let whereClauses = [];

    if (req.user.role === 'user') {
      // Pemimpin Cabang + scope=unit-office: seluruh KPI di unit kantor (unit + anggota)
      if (req.query.scope === 'unit-office' && isPemimpinCabangJabatan(req.user.jabatan)) {
        whereClauses.push('unit_name = ?');
        queryParams.push(req.user.unit_name);
      } else {
        whereClauses.push('jabatan = ? AND unit_name = ?');
        queryParams.push(req.user.jabatan, req.user.unit_name);
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

    const parsedKpis = kpis.map(parseKpiJsonFields);

    res.json(parsedKpis);
  } catch (error) {
    console.error('Get KPIs error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/', authenticateToken, authorizeRole('superadmin', 'admin', 'user'), auditMiddleware('CREATE_KPI'), async (req, res) => {
  try {
    const kpi = { ...req.body };
    // Pegawai hanya boleh membuat KPI untuk jabatan/unit sendiri
    if (req.user.role === 'user') {
      kpi.jabatan = req.user.jabatan;
      kpi.unit_name = req.user.unit_name;
      kpi.unit_type = 'pegawai';
    }
    if (!kpi.name || !String(kpi.name).trim()) {
      return res.status(400).json({ message: 'Nama KPI wajib diisi' });
    }
    if (!kpi.unit_name || !kpi.jabatan) {
      return res.status(400).json({ message: 'Unit kerja dan jabatan wajib diisi' });
    }

    await assertUniqueKpiName(db, {
      name: kpi.name,
      unit_name: kpi.unit_name,
      jabatan: kpi.jabatan,
    });

    const id = 'kpi_' + Date.now() + Math.floor(Math.random() * 1000);
    const masterCode = await resolveMasterCodeForName(db, kpi.name);

    await db.query(
      'INSERT INTO kpis (id, kpi_code, name, perspective, unit, polarity, target, actual, weight, unit_name, jabatan, strategy_id, monthly_data, monthly_target, unit_type, parent_kpi_id, status, description, formula, objective) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id, masterCode, kpi.name, kpi.perspective, kpi.unit, kpi.polarity || 'maximize', kpi.target || 0, kpi.actual || 0, kpi.weight || 0,
        kpi.unit_name, kpi.jabatan, kpi.strategy_id, JSON.stringify(kpi.monthly_data || {}), JSON.stringify(kpi.monthly_target || {}),
        kpi.unit_type || 'pegawai', masterCode, kpi.status || 'Draft', kpi.description || null, kpi.formula || null, kpi.objective || null
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
      // Input realisasi & target bulanan dibuka untuk semua user (tidak diblokir monthly_data_locked)
    }

    const mergedMonthly = mergeMonthlyDataRespectingLock(existing, incomingMonthly || {}, req.user.role);
    const mergedTarget = incomingTarget
      ? mergeMonthlyTarget(existing, incomingTarget)
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

    try { await reaggregateIfChildOrMaster(db, id); } catch (e) { console.warn('master reaggregate after realisasi:', e.message); }

    const [updated] = await db.query('SELECT * FROM kpis WHERE id = ?', [id]);
    res.json(parseKpiJsonFields(updated[0]));
  } catch (error) {
    console.error('Update KPI realisasi error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.put('/:id', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('UPDATE_KPI'), async (req, res) => {
  try {
    const { id } = req.params;
    const kpi = req.body;

    if (!kpi.name || !String(kpi.name).trim()) {
      return res.status(400).json({ message: 'Nama KPI wajib diisi' });
    }

    const [existingRows] = await db.query(
      'SELECT id, name, kpi_code, parent_kpi_id, unit_type FROM kpis WHERE id = ?',
      [id]
    );
    if (!existingRows.length) {
      return res.status(404).json({ message: 'KPI tidak ditemukan' });
    }
    const existingForUpdate = existingRows[0];

    await assertUniqueKpiName(db, {
      name: kpi.name,
      unit_name: kpi.unit_name,
      jabatan: kpi.jabatan,
      excludeId: id,
    });

    if (isMasterKpiId(id) || existingForUpdate?.unit_type === 'master') {
      return res.status(400).json({ message: 'KPI master tidak boleh diubah manual. Gunakan reaggregate.' });
    }

    const masterCode = await resolveMasterCodeForName(db, kpi.name);

    await db.query(
      'UPDATE kpis SET name=?, perspective=?, unit=?, polarity=?, target=?, actual=?, weight=?, unit_name=?, jabatan=?, strategy_id=?, manual_indeks=?, monthly_data=?, monthly_target=?, status=?, unit_type=?, description=?, formula=?, objective=?, parent_kpi_id=?, kpi_code=? WHERE id=?',
      [
        kpi.name, kpi.perspective, kpi.unit, kpi.polarity || 'maximize', kpi.target, kpi.actual, kpi.weight,
        kpi.unit_name, kpi.jabatan, kpi.strategy_id || null,
        kpi.manual_indeks !== undefined && kpi.manual_indeks !== null && kpi.manual_indeks !== '' ? kpi.manual_indeks : null,
        JSON.stringify(kpi.monthly_data || {}),
        JSON.stringify(kpi.monthly_target || {}),
        kpi.status || 'Draft', kpi.unit_type || 'pegawai',
        kpi.description || null, kpi.formula || null, kpi.objective || null,
        masterCode, masterCode, id
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

router.delete('/:id', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('DELETE_KPI'), async (req, res) => {
  try {
    const { id } = req.params;
    if (isMasterKpiId(id)) {
      return res.status(400).json({ message: 'KPI master tidak boleh dihapus' });
    }

    const [rows] = await db.query('SELECT kpi_code, parent_kpi_id FROM kpis WHERE id = ?', [id]);
    const code = rows[0]?.kpi_code || rows[0]?.parent_kpi_id;

    await db.query('DELETE FROM kpis WHERE id = ?', [id]);

    if (code && isMasterKpiId(code)) {
      try { await aggregateMasterFromChildren(db, code); } catch (e) { console.warn('master reaggregate after delete:', e.message); }
    }

    res.json({ message: 'KPI berhasil dihapus' });
  } catch (error) {
    console.error('Delete KPI error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

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
    await db.query(
      `UPDATE kpis SET status = ? WHERE ${scope.where}`,
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

    if (role === 'superadmin') {
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

      // Tanpa filter: batasi ke user yang punya KPI berstatus approval (hindari scan semua pegawai)
      if (!unitNameQuery && !jabatanQuery) {
        queryStr += ` AND (jabatan, unit_name) IN (
          SELECT DISTINCT jabatan, unit_name FROM kpis
          WHERE status IN ('Submitted','submitted','Menunggu','Pending','Approved','approved','Rejected','rejected')
        )`;
      }

      const [superadminSubordinates] = await db.query(queryStr, queryParams);
      subordinates = superadminSubordinates;
    } else {
      const [directSubordinates] = await db.query(
        'SELECT name, npp, jabatan, unit_name, supervisi_approval FROM users WHERE supervisi_approval = ?',
        [pimpinanName]
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
      `SELECT status, actual, target, weight, manual_indeks, jabatan, unit_name, unit, monthly_data, monthly_target FROM kpis WHERE ${placeholders}`,
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
        const status = kpis[0].status || 'Draft';
        let totalBobot = 0;
        let totalHasil = 0;

        kpis.forEach(kpi => {
          const { hasil } = computeKpiYtdScores(kpi);
          const weight = parseFloat(kpi.weight) || 0;
          totalBobot += weight;
          totalHasil += hasil;
        });

        results.push({
          ...sub,
          status,
          total_kpi: kpis.length,
          total_bobot: totalBobot,
          total_hasil: totalHasil
        });
      } else {
        results.push({
          ...sub,
          status: 'Belum Ada KPI',
          total_kpi: 0,
          total_bobot: 0,
          total_hasil: 0
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Approval list error:', error.message);
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
