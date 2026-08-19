const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { activateLimiter } = require('../middleware/rate-limiter');
const { computeKpiYtdScores } = require('../lib/kpi-scoring');

const router = express.Router();

const EXPIRATION_DATE = new Date('2027-01-31T23:59:59');
const LICENSE_FILE = path.join(__dirname, '../license.json');

router.get('/license', (req, res) => {
  const now = new Date();
  let isExpired = now > EXPIRATION_DATE;
  let isActivated = false;

  if (fs.existsSync(LICENSE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
      if (data.activated === true && data.token === process.env.ACTIVATION_TOKEN) {
        isActivated = true;
        isExpired = false;
      }
    } catch (e) {}
  }

  res.json({ expired: isExpired, activated: isActivated });
});

router.post('/license/activate', activateLimiter, async (req, res) => {
  const { token } = req.body;

  if (token === process.env.ACTIVATION_TOKEN) {
    fs.writeFileSync(LICENSE_FILE, JSON.stringify({ activated: true, token: process.env.ACTIVATION_TOKEN }));
    res.json({ success: true, message: 'Aplikasi berhasil diaktifkan kembali.' });
  } else {
    res.status(400).json({ success: false, message: 'Kode token tidak valid.' });
  }
});

// Classifies unit_type into corporate/divisi/cabang/cabang_pembantu, tolerating
// both the modern short codes ('kc', 'kck', 'kcp') and legacy long-form labels
// ('Kantor Cabang Pembantu', 'Cabang Pembantu', 'Kantor Cabang Koordinator').
function classifyOrgLevel(unitType) {
  const t = (unitType || '').toString().trim().toLowerCase();
  if (!t) return null;
  if (t === 'corporate') return 'corporate';
  if (t === 'divisi') return 'divisi';
  if (t === 'kcp' || t.includes('pembantu')) return 'cabang_pembantu';
  if (t === 'kck' || t === 'kc' || t.includes('koordinator') || t.includes('cabang')) return 'cabang';
  return null;
}

function hasMonthlyRealisasi(monthlyData) {
  if (!monthlyData || typeof monthlyData !== 'object') return false;
  const values = Array.isArray(monthlyData) ? monthlyData : Object.values(monthlyData);
  return values.some(
    (v) => v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v)) && Number(v) !== 0
  );
}

// Public, unauthenticated aggregate summary (counts + achievement %) used to
// render the marketing/summary charts on the Login page. Intentionally never
// exposes individual KPI names, unit names, or personal data.
router.get('/public-summary', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT unit_type, perspective, target, actual, unit, polarity, monthly_data, monthly_target FROM kpis'
    );

    const levels = {
      corporate: { count: 0, sum: 0, n: 0 },
      divisi: { count: 0, sum: 0, n: 0 },
      cabang: { count: 0, sum: 0, n: 0 },
      cabang_pembantu: { count: 0, sum: 0, n: 0 },
    };
    const perspectives = {
      financial: { sum: 0, n: 0 },
      customer: { sum: 0, n: 0 },
      internal_process: { sum: 0, n: 0 },
      learning_growth: { sum: 0, n: 0 },
    };

    let totalKpis = 0;
    let overallSum = 0;
    let overallN = 0;

    for (const row of rows) {
      totalKpis += 1;
      const { pencapaian: raw } = computeKpiYtdScores(row);
      const pencapaian = Math.min(Math.max(raw || 0, 0), 120);
      const measurable = hasMonthlyRealisasi(row.monthly_data) || pencapaian > 0;
      const level = classifyOrgLevel(row.unit_type);

      if (level && levels[level]) {
        levels[level].count += 1;
        if (measurable) {
          levels[level].sum += pencapaian;
          levels[level].n += 1;
        }
      }

      if (perspectives[row.perspective] && measurable) {
        perspectives[row.perspective].sum += pencapaian;
        perspectives[row.perspective].n += 1;
      }

      if (measurable) {
        overallSum += pencapaian;
        overallN += 1;
      }
    }

    res.json({
      totalKpis,
      overallPencapaian: overallN > 0 ? Math.round(overallSum / overallN) : 0,
      orgLevels: Object.entries(levels).map(([key, v]) => ({
        key,
        count: v.count,
        pencapaian: v.n > 0 ? Math.round(v.sum / v.n) : 0,
      })),
      perspectives: Object.entries(perspectives).map(([key, v]) => ({
        key,
        pencapaian: v.n > 0 ? Math.round(v.sum / v.n) : 0,
      })),
    });
  } catch (error) {
    console.error('Public summary error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

const authenticateToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorize');
const { auditMiddleware } = require('../middleware/audit');

/** Backup ringkas data master + KPI (JSON) — superadmin only */
router.get('/backup', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const [kpis] = await db.query('SELECT * FROM kpis');
    const [pegawai] = await db.query('SELECT * FROM pegawai');
    const [users] = await db.query(
      'SELECT id, pegawai_id, name, username, role, npp, jabatan, unit_name, supervisi_approval, last_login, created_at FROM users'
    );
    const [objectives] = await db.query('SELECT * FROM objectives');
    const [strategies] = await db.query('SELECT * FROM strategies');
    const [satuans] = await db.query('SELECT * FROM satuans');
    const [targets] = await db.query('SELECT * FROM targets');
    let logs = [];
    try {
      const [logRows] = await db.query(
        'SELECT id, user_name, user_role, action, details, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 5000'
      );
      logs = logRows;
    } catch (_) {
      logs = [];
    }

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.username || req.user?.name || 'unknown',
      tables: {
        kpis,
        pegawai,
        users,
        objectives,
        strategies,
        satuans,
        targets,
        activity_logs: logs,
      },
      counts: {
        kpis: kpis.length,
        pegawai: pegawai.length,
        users: users.length,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="kinerjaberkah-backup-${new Date().toISOString().slice(0, 10)}.json"`
    );
    res.json(payload);
  } catch (error) {
    console.error('Backup error:', error.message);
    res.status(500).json({ message: 'Gagal membuat backup: ' + error.message });
  }
});

/**
 * Reset data KPI — superadmin only.
 * mode:
 *  - realisasi: kosongkan monthly_data (+ unlock status Draft)
 *  - draft: hapus KPI berstatus Draft
 *  - unit: hapus KPI untuk unit_name tertentu (body.unit_name wajib)
 */
router.post(
  '/reset-kpi',
  authenticateToken,
  authorizeRole('superadmin'),
  auditMiddleware('RESET_KPI'),
  async (req, res) => {
    try {
      const { mode, confirm, unit_name: unitName } = req.body || {};
      if (confirm !== 'RESET') {
        return res.status(400).json({ message: 'Konfirmasi wajib: ketik RESET' });
      }
      if (!['realisasi', 'draft', 'unit'].includes(mode)) {
        return res.status(400).json({ message: 'Mode tidak valid' });
      }

      let result;
      if (mode === 'realisasi') {
        [result] = await db.query(
          `UPDATE kpis SET
            monthly_data = JSON_OBJECT(),
            actual = 0,
            status = 'Draft',
            approved_by = NULL,
            approved_at = NULL
           WHERE 1=1`
        );
      } else if (mode === 'draft') {
        [result] = await db.query(`DELETE FROM kpis WHERE status = 'Draft' OR status IS NULL OR status = ''`);
      } else {
        if (!unitName || !String(unitName).trim()) {
          return res.status(400).json({ message: 'unit_name wajib untuk mode unit' });
        }
        [result] = await db.query('DELETE FROM kpis WHERE unit_name = ?', [String(unitName).trim()]);
      }

      res.json({
        message: 'Reset berhasil',
        mode,
        affected: result?.affectedRows ?? 0,
      });
    } catch (error) {
      console.error('Reset KPI error:', error.message);
      res.status(500).json({ message: 'Gagal reset: ' + error.message });
    }
  }
);

/** Ringkasan notifikasi dari approval pending + log terbaru */
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const role = req.user?.role;
    const items = [];

    if (role === 'admin' || role === 'superadmin') {
      const [pending] = await db.query(
        `SELECT COUNT(*) AS c FROM kpis WHERE status IN ('Submitted','submitted','Menunggu','Pending')`
      );
      const count = pending?.[0]?.c || 0;
      if (count > 0) {
        items.push({
          id: 'approval-pending',
          type: 'approval',
          title: 'KPI menunggu persetujuan',
          body: `${count} KPI berstatus menunggu review/approval`,
          href: '/approval-kpi',
          createdAt: new Date().toISOString(),
        });
      }
    }

    let logs = [];
    try {
      const [logRows] = await db.query(
        `SELECT id, user_name, user_role, action, details, created_at
         FROM activity_logs
         ORDER BY created_at DESC
         LIMIT 30`
      );
      logs = logRows;
    } catch (_) {
      logs = [];
    }

    logs.forEach((log) => {
      items.push({
        id: `log-${log.id}`,
        type: 'activity',
        title: log.action || 'Aktivitas',
        body: `${log.user_name || 'Sistem'}${log.details ? ` — ${String(log.details).slice(0, 120)}` : ''}`,
        href: '/log-trails',
        createdAt: log.created_at,
      });
    });

    res.json({ data: items.slice(0, 40), unread: items.filter((i) => i.type === 'approval').length });
  } catch (error) {
    console.error('Notifications error:', error.message);
    res.status(500).json({ message: 'Gagal memuat notifikasi' });
  }
});

module.exports = router;
