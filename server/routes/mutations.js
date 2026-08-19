const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorize');
const { assertPegawaiAccess } = require('../lib/pegawai-access');
const { auditMiddleware } = require('../middleware/audit');
const { computeKpiYtdScores } = require('../lib/kpi-scoring');

const router = express.Router();

const PERSPECTIVE_KEYS = ['financial', 'customer', 'internal_process', 'learning_growth'];
const PERSPECTIVE_LABELS = {
  financial: 'Finansial',
  customer: 'Pelanggan',
  internal_process: 'Proses Internal',
  learning_growth: 'Pembelajaran & Pertumbuhan',
};

function normalizePerspective(perspective) {
  const v = String(perspective || '').toLowerCase();
  if (v.includes('customer') || v.includes('pelanggan')) return 'customer';
  if (v.includes('internal') || v.includes('proses') || v.includes('process')) return 'internal_process';
  if (v.includes('learning') || v.includes('growth') || v.includes('people') || v.includes('pembelajaran')) {
    return 'learning_growth';
  }
  return 'financial';
}

function parseJsonArr(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return []; }
  }
  return [];
}

function parseMutationRow(m) {
  return {
    ...m,
    old_kpi_ids: parseJsonArr(m.old_kpi_ids),
    new_kpi_ids: parseJsonArr(m.new_kpi_ids),
    mutation_type: m.mutation_type || 'Mutasi',
    reason: m.reason || '',
    sk_number: m.sk_number || '',
    notes: m.notes || '',
  };
}

function summarizeKpisByPerspective(kpis = []) {
  const buckets = {};
  PERSPECTIVE_KEYS.forEach((k) => {
    buckets[k] = { key: k, label: PERSPECTIVE_LABELS[k], count: 0, weight: 0 };
  });
  kpis.forEach((kpi) => {
    const key = normalizePerspective(kpi.perspective);
    if (!buckets[key]) {
      buckets[key] = { key, label: PERSPECTIVE_LABELS[key] || key, count: 0, weight: 0 };
    }
    buckets[key].count += 1;
    buckets[key].weight += parseFloat(kpi.weight) || 0;
  });
  const rows = PERSPECTIVE_KEYS.map((k) => ({
    ...buckets[k],
    weight: Math.round(buckets[k].weight * 100) / 100,
  }));
  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const totalWeight = Math.round(rows.reduce((s, r) => s + r.weight, 0) * 100) / 100;
  return { rows, totalCount, totalWeight };
}

async function ensureMutationSchema() {
  const alters = [
    "ALTER TABLE mutation_history ADD COLUMN mutation_type VARCHAR(50) DEFAULT 'Mutasi'",
    'ALTER TABLE mutation_history ADD COLUMN reason VARCHAR(255) NULL',
    'ALTER TABLE mutation_history ADD COLUMN sk_number VARCHAR(100) NULL',
    'ALTER TABLE mutation_history ADD COLUMN notes TEXT NULL',
  ];
  for (const sql of alters) {
    try { await db.query(sql); } catch { /* column may exist */ }
  }
  try {
    await db.query(
      "ALTER TABLE mutation_history MODIFY COLUMN status ENUM('active','completed','cancelled') DEFAULT 'active'"
    );
  } catch { /* ignore */ }
}

ensureMutationSchema().catch(() => {});

router.post('/', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('CREATE_MUTATION'), async (req, res) => {
  const {
    pegawai_id, npp, employee_name, old_unit_name, old_jabatan, old_unit_type,
    new_unit_name, new_jabatan, new_unit_type, effective_date, created_by,
    mutation_type, reason, sk_number, notes,
  } = req.body;

  try {
    if (!pegawai_id || !effective_date || !new_unit_name || !new_jabatan) {
      return res.status(400).json({ message: 'Data mutasi tidak lengkap' });
    }

    await ensureMutationSchema();

    const year = new Date(effective_date).getFullYear();
    const dayBefore = new Date(effective_date);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const old_period_end = dayBefore.toISOString().slice(0, 10);
    const old_period_start = `${year}-01-01`;
    const new_period_start = effective_date;
    const new_period_end = `${year}-12-31`;

    const [oldKpis] = await db.query(
      'SELECT id FROM kpis WHERE unit_name = ? AND jabatan = ?',
      [old_unit_name, old_jabatan]
    );
    const old_kpi_ids = oldKpis.map((k) => k.id);

    const [result] = await db.query(
      `INSERT INTO mutation_history (
        pegawai_id, npp, employee_name,
        old_unit_name, old_jabatan, old_unit_type,
        new_unit_name, new_jabatan, new_unit_type,
        effective_date,
        old_period_start, old_period_end,
        new_period_start, new_period_end,
        old_kpi_ids, new_kpi_ids,
        mutation_type, reason, sk_number, notes,
        created_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        pegawai_id, npp, employee_name,
        old_unit_name, old_jabatan, old_unit_type,
        new_unit_name, new_jabatan, new_unit_type,
        effective_date,
        old_period_start, old_period_end,
        new_period_start, new_period_end,
        JSON.stringify(old_kpi_ids),
        JSON.stringify([]),
        mutation_type || 'Mutasi',
        reason || null,
        sk_number || null,
        notes || null,
        created_by,
      ]
    );

    const mutationId = result.insertId;

    const [newKpis] = await db.query(
      'SELECT * FROM kpis WHERE unit_name = ? AND jabatan = ?',
      [new_unit_name, new_jabatan]
    );

    if (newKpis.length === 0) {
      const [oldKpiDetails] = await db.query(
        'SELECT * FROM kpis WHERE unit_name = ? AND jabatan = ?',
        [old_unit_name, old_jabatan]
      );

      const newKpiIds = [];
      for (const kpi of oldKpiDetails) {
        const id = `kpi_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        await db.query(
          `INSERT INTO kpis (
            id, name, unit, polarity, weight, target, actual, status, perspective,
            jabatan, unit_type, unit_name, monthly_data, manual_indeks, is_locked
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 'Draft', ?, ?, ?, ?, '{}', NULL, 0)`,
          [
            id, kpi.name, kpi.unit, kpi.polarity || 'maximize', kpi.weight, kpi.target,
            kpi.perspective, new_jabatan, new_unit_type, new_unit_name,
          ]
        );
        newKpiIds.push(id);
      }

      await db.query(
        'UPDATE mutation_history SET new_kpi_ids = ? WHERE id = ?',
        [JSON.stringify(newKpiIds), mutationId]
      );
    } else {
      const newKpiIds = newKpis.map((k) => k.id);
      await db.query(
        'UPDATE mutation_history SET new_kpi_ids = ? WHERE id = ?',
        [JSON.stringify(newKpiIds), mutationId]
      );
    }

    await db.query(
      'UPDATE pegawai SET unit_name = ?, jabatan = ? WHERE id = ?',
      [new_unit_name, new_jabatan, pegawai_id]
    );

    // Lock KPI unit asal (periode sebelum mutasi)
    if (old_kpi_ids.length) {
      await db.query(
        `UPDATE kpis SET is_locked = 1 WHERE id IN (${old_kpi_ids.map(() => '?').join(',')})`,
        old_kpi_ids
      );
    }

    res.json({
      success: true,
      message: 'Mutasi berhasil dicatat dan KPI telah di-split',
      mutation_id: mutationId,
    });
  } catch (error) {
    console.error('Mutation error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server: ' + error.message });
  }
});

router.get('/', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    await ensureMutationSchema();
    const [mutations] = await db.query(
      'SELECT * FROM mutation_history ORDER BY effective_date DESC, id DESC'
    );
    res.json(mutations.map(parseMutationRow));
  } catch (error) {
    console.error('Get all mutations error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

/** Detail mutasi + ringkasan KPI per perspektif */
router.get('/detail/:id', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    await ensureMutationSchema();
    const [rows] = await db.query('SELECT * FROM mutation_history WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Mutasi tidak ditemukan' });

    const mutation = parseMutationRow(rows[0]);
    let oldKpis = [];
    let newKpis = [];

    if (mutation.old_kpi_ids?.length) {
      const [oks] = await db.query(
        `SELECT * FROM kpis WHERE id IN (${mutation.old_kpi_ids.map(() => '?').join(',')})`,
        mutation.old_kpi_ids
      );
      oldKpis = oks;
    } else {
      const [oks] = await db.query(
        'SELECT * FROM kpis WHERE unit_name = ? AND jabatan = ?',
        [mutation.old_unit_name, mutation.old_jabatan]
      );
      oldKpis = oks;
    }

    if (mutation.new_kpi_ids?.length) {
      const [nks] = await db.query(
        `SELECT * FROM kpis WHERE id IN (${mutation.new_kpi_ids.map(() => '?').join(',')})`,
        mutation.new_kpi_ids
      );
      newKpis = nks;
    } else {
      const [nks] = await db.query(
        'SELECT * FROM kpis WHERE unit_name = ? AND jabatan = ?',
        [mutation.new_unit_name, mutation.new_jabatan]
      );
      newKpis = nks;
    }

    const [history] = await db.query(
      'SELECT * FROM mutation_history WHERE pegawai_id = ? ORDER BY effective_date DESC, id DESC',
      [mutation.pegawai_id]
    );

    const [pegawaiRows] = await db.query('SELECT * FROM pegawai WHERE id = ?', [mutation.pegawai_id]);

    res.json({
      mutation,
      pegawai: pegawaiRows[0] || null,
      old: {
        unit_name: mutation.old_unit_name,
        jabatan: mutation.old_jabatan,
        period_start: mutation.old_period_start,
        period_end: mutation.old_period_end,
        kpis: oldKpis,
        summary: summarizeKpisByPerspective(oldKpis),
        assessorHint: `Pemimpin ${mutation.old_unit_name}`,
      },
      new: {
        unit_name: mutation.new_unit_name,
        jabatan: mutation.new_jabatan,
        period_start: mutation.new_period_start,
        period_end: mutation.new_period_end,
        kpis: newKpis,
        summary: summarizeKpisByPerspective(newKpis),
        assessorHint: `Pemimpin ${mutation.new_unit_name}`,
      },
      history: history.map(parseMutationRow),
    });
  } catch (error) {
    console.error('Get mutation detail error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/:id/cancel', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('CANCEL_MUTATION'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM mutation_history WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Mutasi tidak ditemukan' });
    const m = parseMutationRow(rows[0]);
    if (m.status === 'cancelled') {
      return res.status(400).json({ message: 'Mutasi sudah dibatalkan' });
    }

    await db.query(
      "UPDATE mutation_history SET status = 'cancelled' WHERE id = ?",
      [req.params.id]
    );

    // Kembalikan pegawai ke unit asal bila mutasi ini masih yang aktif terkini
    const [latest] = await db.query(
      `SELECT id FROM mutation_history
       WHERE pegawai_id = ? AND status = 'active'
       ORDER BY effective_date DESC, id DESC LIMIT 1`,
      [m.pegawai_id]
    );
    if (!latest.length || Number(latest[0].id) === Number(m.id)) {
      await db.query(
        'UPDATE pegawai SET unit_name = ?, jabatan = ? WHERE id = ?',
        [m.old_unit_name, m.old_jabatan, m.pegawai_id]
      );
    }

    res.json({ success: true, message: 'Mutasi dibatalkan' });
  } catch (error) {
    console.error('Cancel mutation error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/:pegawai_id', authenticateToken, async (req, res) => {
  try {
    if (!(await assertPegawaiAccess(req, res, db, req.params.pegawai_id))) return;
    const [mutations] = await db.query(
      'SELECT * FROM mutation_history WHERE pegawai_id = ? ORDER BY effective_date DESC',
      [req.params.pegawai_id]
    );
    res.json(mutations.map(parseMutationRow));
  } catch (error) {
    console.error('Get mutations error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/:pegawai_id/calculate-score', authenticateToken, async (req, res) => {
  try {
    if (!(await assertPegawaiAccess(req, res, db, req.params.pegawai_id))) return;
    const [mutations] = await db.query(
      'SELECT * FROM mutation_history WHERE pegawai_id = ? AND status = "active"',
      [req.params.pegawai_id]
    );

    if (mutations.length === 0) {
      return res.json({ hasMutation: false, score: null });
    }

    const mutation = parseMutationRow(mutations[0]);
    const oldStart = new Date(mutation.old_period_start);
    const oldEnd = new Date(mutation.old_period_end);
    const oldMonths = (oldEnd.getFullYear() - oldStart.getFullYear()) * 12 + (oldEnd.getMonth() - oldStart.getMonth()) + 1;

    const newStart = new Date(mutation.new_period_start);
    const newEnd = new Date(mutation.new_period_end);
    const newMonths = (newEnd.getFullYear() - newStart.getFullYear()) * 12 + (newEnd.getMonth() - newStart.getMonth()) + 1;

    const totalMonths = Math.max(oldMonths + newMonths, 1);
    const oldWeight = oldMonths / totalMonths;
    const newWeight = newMonths / totalMonths;

    let oldKpis = [];
    let newKpis = [];
    if (mutation.old_kpi_ids?.length) {
      const [oks] = await db.query(
        `SELECT * FROM kpis WHERE id IN (${mutation.old_kpi_ids.map(() => '?').join(',')})`,
        mutation.old_kpi_ids
      );
      oldKpis = oks;
    }
    if (mutation.new_kpi_ids?.length) {
      const [nks] = await db.query(
        `SELECT * FROM kpis WHERE id IN (${mutation.new_kpi_ids.map(() => '?').join(',')})`,
        mutation.new_kpi_ids
      );
      newKpis = nks;
    }

    let oldScore = 0;
    let oldTotalWeight = 0;
    for (const kpi of oldKpis) {
      const weight = parseFloat(kpi.weight) || 0;
      const { hasil } = computeKpiYtdScores(kpi);
      oldScore += hasil;
      oldTotalWeight += weight;
    }
    if (oldTotalWeight > 0) oldScore = (oldScore / oldTotalWeight) * 100;

    let newScore = 0;
    let newTotalWeight = 0;
    for (const kpi of newKpis) {
      const weight = parseFloat(kpi.weight) || 0;
      const { hasil } = computeKpiYtdScores(kpi);
      newScore += hasil;
      newTotalWeight += weight;
    }
    if (newTotalWeight > 0) newScore = (newScore / newTotalWeight) * 100;

    const finalScore = (oldScore * oldWeight) + (newScore * newWeight);

    res.json({
      hasMutation: true,
      mutation,
      periods: {
        old: { months: oldMonths, weight: oldWeight, score: oldScore, kpis: oldKpis },
        new: { months: newMonths, weight: newWeight, score: newScore, kpis: newKpis },
      },
      finalScore,
    });
  } catch (error) {
    console.error('Score calculation error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
