const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorize');
const { auditMiddleware } = require('../middleware/audit');

const router = express.Router();

const EVIDENCE_MAX_BYTES = 1 * 1024 * 1024;
const EVIDENCE_DIR = path.join(__dirname, '..', 'uploads', 'kpi-evidence');
const ALLOWED_MIME = new Set([
  'application/pdf',
]);

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS kpi_realisasi_evidence (
      id VARCHAR(64) PRIMARY KEY,
      kpi_id VARCHAR(50) NOT NULL,
      month_key VARCHAR(16) NOT NULL,
      uploaded_by VARCHAR(100) NOT NULL,
      uploader_name VARCHAR(255) NULL,
      original_name VARCHAR(255) NOT NULL,
      stored_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(120) NULL,
      file_size INT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_kpi_month (kpi_id, month_key),
      INDEX idx_kpi_ev_kpi (kpi_id),
      INDEX idx_kpi_ev_month (month_key),
      INDEX idx_kpi_ev_uploader (uploaded_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  tableReady = true;
}

function newId() {
  return `ev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function isPrivileged(user) {
  return user?.role === 'admin' || user?.role === 'superadmin';
}

function decodeEvidence(body) {
  const raw = String(body.fileBase64 || body.base64 || '');
  if (!raw) return null;
  const comma = raw.indexOf(',');
  const b64 = comma >= 0 && raw.slice(0, comma).includes('base64') ? raw.slice(comma + 1) : raw;
  let buf;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch {
    throw Object.assign(new Error('File bukti tidak valid'), { status: 400 });
  }
  if (!buf.length) return null;
  if (buf.length > EVIDENCE_MAX_BYTES) {
    throw Object.assign(new Error('Ukuran bukti maksimal 1 MB'), { status: 400 });
  }
  const mimeType = String(body.mimeType || 'application/octet-stream').toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) {
    throw Object.assign(new Error('Format bukti hanya PDF'), { status: 400 });
  }
  const originalName = path
    .basename(String(body.originalName || 'bukti'))
    .replace(/[^\w.\- ()]+/g, '_')
    .slice(0, 120);
  const ext = path.extname(originalName).slice(0, 12) || '';
  if (ext.toLowerCase() !== '.pdf') {
    throw Object.assign(new Error('Format bukti hanya PDF'), { status: 400 });
  }
  const stored = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.pdf`;
  return { buf, stored, originalName, mimeType, fileSize: buf.length };
}

function saveFile(decoded) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_DIR, decoded.stored), decoded.buf);
}

function removeStoredFile(storedName) {
  if (!storedName) return;
  const fp = path.join(EVIDENCE_DIR, path.basename(String(storedName)));
  try {
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch {
    /* ignore */
  }
}

async function loadKpi(kpiId) {
  const [rows] = await db.query(
    'SELECT id, name, jabatan, unit_name, perspective FROM kpis WHERE id = ? LIMIT 1',
    [kpiId]
  );
  return rows[0] || null;
}

async function assertCanAccessKpi(user, kpi) {
  if (!kpi) return false;
  if (isPrivileged(user)) return true;
  return (
    String(user.jabatan || '') === String(kpi.jabatan || '') &&
    String(user.unit_name || '') === String(kpi.unit_name || '')
  );
}

router.post(
  '/',
  authenticateToken,
  auditMiddleware('UPLOAD_KPI_EVIDENCE'),
  async (req, res) => {
    try {
      await ensureTable();
      const kpiId = String(req.body?.kpi_id || '').trim();
      const monthKey = String(req.body?.month_key || '').trim();
      if (!kpiId || !monthKey) {
        return res.status(400).json({ message: 'kpi_id dan month_key wajib diisi' });
      }

      const kpi = await loadKpi(kpiId);
      if (!kpi) return res.status(404).json({ message: 'KPI tidak ditemukan' });
      if (!(await assertCanAccessKpi(req.user, kpi))) {
        return res.status(403).json({ message: 'Anda tidak berhak mengunggah bukti untuk KPI ini' });
      }

      const decoded = decodeEvidence(req.body || {});
      if (!decoded) {
        return res.status(400).json({ message: 'File bukti wajib diunggah' });
      }

      const [existing] = await db.query(
        'SELECT id, stored_name FROM kpi_realisasi_evidence WHERE kpi_id = ? AND month_key = ? LIMIT 1',
        [kpiId, monthKey]
      );

      saveFile(decoded);
      const id = existing[0]?.id || newId();
      const notes = String(req.body?.notes || '').trim().slice(0, 500) || null;

      if (existing[0]) {
        removeStoredFile(existing[0].stored_name);
        await db.query(
          `UPDATE kpi_realisasi_evidence
           SET uploaded_by = ?, uploader_name = ?, original_name = ?, stored_name = ?,
               mime_type = ?, file_size = ?, notes = ?, created_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            req.user.id,
            req.user.name || req.user.username || null,
            decoded.originalName,
            decoded.stored,
            decoded.mimeType,
            decoded.fileSize,
            notes,
            id,
          ]
        );
      } else {
        await db.query(
          `INSERT INTO kpi_realisasi_evidence
            (id, kpi_id, month_key, uploaded_by, uploader_name, original_name, stored_name, mime_type, file_size, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            kpiId,
            monthKey,
            req.user.id,
            req.user.name || req.user.username || null,
            decoded.originalName,
            decoded.stored,
            decoded.mimeType,
            decoded.fileSize,
            notes,
          ]
        );
      }

      // Keep human-readable pointer in KPI notes (optional, non-destructive append)
      try {
        const marker = `Bukti ${monthKey}: ${decoded.originalName}`;
        const [kpiRows] = await db.query('SELECT notes FROM kpis WHERE id = ? LIMIT 1', [kpiId]);
        const prev = String(kpiRows[0]?.notes || '');
        if (!prev.includes(marker)) {
          const next = prev ? `${prev}\n${marker}` : marker;
          await db.query('UPDATE kpis SET notes = ? WHERE id = ?', [next.slice(0, 2000), kpiId]);
        }
      } catch {
        /* notes column may be missing on older DBs */
      }

      res.json({
        success: true,
        id,
        kpi_id: kpiId,
        month_key: monthKey,
        original_name: decoded.originalName,
        stored_name: decoded.stored,
        file_size: decoded.fileSize,
        message: 'Bukti realisasi berhasil diunggah',
      });
    } catch (error) {
      console.error('upload kpi-evidence:', error.message);
      res.status(error.status || 500).json({
        message: error.message || 'Gagal mengunggah bukti',
      });
    }
  }
);

router.get('/', authenticateToken, async (req, res) => {
  try {
    await ensureTable();
    const { kpi_id, month_key, search, unit_name } = req.query;
    const params = [];
    const where = [];

    if (!isPrivileged(req.user)) {
      where.push('k.jabatan = ? AND k.unit_name = ?');
      params.push(req.user.jabatan || '', req.user.unit_name || '');
    } else if (unit_name) {
      where.push('k.unit_name = ?');
      params.push(String(unit_name));
    }

    if (kpi_id) {
      where.push('e.kpi_id = ?');
      params.push(String(kpi_id));
    }
    if (month_key) {
      where.push('e.month_key = ?');
      params.push(String(month_key));
    }
    if (search) {
      where.push(
        '(k.name LIKE ? OR e.original_name LIKE ? OR e.uploader_name LIKE ? OR k.jabatan LIKE ? OR k.unit_name LIKE ?)'
      );
      const q = `%${String(search).trim()}%`;
      params.push(q, q, q, q, q);
    }

    const sql = `
      SELECT e.id, e.kpi_id, e.month_key, e.uploaded_by, e.uploader_name,
             e.original_name, e.stored_name, e.mime_type, e.file_size, e.notes, e.created_at,
             k.name AS kpi_name, k.jabatan, k.unit_name, k.perspective
      FROM kpi_realisasi_evidence e
      LEFT JOIN kpis k ON k.id = e.kpi_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY e.created_at DESC
      LIMIT 500
    `;
    const [rows] = await db.query(sql, params);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: rows, total: rows.length });
  } catch (error) {
    console.error('list kpi-evidence:', error.message);
    res.status(500).json({ message: 'Gagal memuat daftar bukti', data: [] });
  }
});

router.get('/file/:filename', authenticateToken, async (req, res) => {
  try {
    await ensureTable();
    const filename = path.basename(String(req.params.filename || ''));
    if (!filename) return res.status(400).json({ message: 'Nama file tidak valid' });

    const [rows] = await db.query(
      `SELECT e.*, k.jabatan, k.unit_name
       FROM kpi_realisasi_evidence e
       LEFT JOIN kpis k ON k.id = e.kpi_id
       WHERE e.stored_name = ? LIMIT 1`,
      [filename]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Bukti tidak ditemukan' });

    const row = rows[0];
    if (!isPrivileged(req.user)) {
      const ok =
        String(req.user.jabatan || '') === String(row.jabatan || '') &&
        String(req.user.unit_name || '') === String(row.unit_name || '');
      if (!ok) return res.status(403).json({ message: 'Akses ditolak' });
    }

    const filePath = path.join(EVIDENCE_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Berkas bukti tidak ada di server' });
    }
    res.download(filePath, row.original_name || filename);
  } catch (error) {
    console.error('download kpi-evidence:', error.message);
    res.status(500).json({ message: 'Gagal mengunduh bukti' });
  }
});

router.delete(
  '/:id',
  authenticateToken,
  authorizeRole('superadmin', 'admin'),
  auditMiddleware('DELETE_KPI_EVIDENCE'),
  async (req, res) => {
    try {
      await ensureTable();
      const id = String(req.params.id || '');
      const [rows] = await db.query(
        'SELECT stored_name FROM kpi_realisasi_evidence WHERE id = ? LIMIT 1',
        [id]
      );
      if (!rows[0]) return res.status(404).json({ message: 'Bukti tidak ditemukan' });
      removeStoredFile(rows[0].stored_name);
      await db.query('DELETE FROM kpi_realisasi_evidence WHERE id = ?', [id]);
      res.json({ success: true, message: 'Bukti dihapus' });
    } catch (error) {
      console.error('delete kpi-evidence:', error.message);
      res.status(500).json({ message: 'Gagal menghapus bukti' });
    }
  }
);

module.exports = router;
