const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorize');

const router = express.Router();

const PEGAWAI_STATUS = {
  aktif: 'aktif',
  non_aktif: 'non_aktif',
  pensiun: 'pensiun',
  keluar: 'keluar',
};

function normalizePegawaiStatus(raw) {
  const v = String(raw || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (['aktif', 'active'].includes(v)) return PEGAWAI_STATUS.aktif;
  if (['non_aktif', 'nonaktif', 'non-aktif', 'inactive'].includes(v)) return PEGAWAI_STATUS.non_aktif;
  if (['pensiun', 'retired'].includes(v)) return PEGAWAI_STATUS.pensiun;
  if (['keluar', 'habis_kontrak', 'habiskontrak', 'resign', 'kontrak'].includes(v)) return PEGAWAI_STATUS.keluar;
  return PEGAWAI_STATUS.aktif;
}

let schemaReady = false;
async function ensurePegawaiSchema() {
  if (schemaReady) return;
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM pegawai LIKE 'status'");
    if (!cols.length) {
      await db.query(
        "ALTER TABLE pegawai ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'aktif' COMMENT 'aktif|non_aktif|pensiun|keluar' AFTER unit_name"
      );
      try { await db.query('CREATE INDEX idx_pegawai_status ON pegawai (status)'); } catch { /* ignore */ }
    }
    schemaReady = true;
  } catch (err) {
    console.warn('ensurePegawaiSchema:', err.message);
  }
}

ensurePegawaiSchema().catch(() => {});

router.get('/', authenticateToken, async (req, res) => {
  try {
    await ensurePegawaiSchema();
    const { search = '', page, limit = '100', unit_name = '', jabatan = '', status = '' } = req.query;
    const isPaginated = page !== undefined && page !== '';

    const whereParts = [];
    const queryParams = [];

    if (req.user.role === 'user') {
      const [users] = await db.query(
        'SELECT pegawai_id, npp, jabatan, unit_name, name FROM users WHERE id = ? LIMIT 1',
        [req.user.id]
      );
      const me = users[0] || {};
      if (me.pegawai_id) {
        whereParts.push('id = ?');
        queryParams.push(me.pegawai_id);
      } else if (me.npp) {
        // Fallback: user tanpa pegawai_id tetap bisa load data diri via NPP
        whereParts.push('npp = ?');
        queryParams.push(me.npp);
      } else if (me.jabatan && me.unit_name) {
        whereParts.push('jabatan = ? AND unit_name = ?');
        queryParams.push(me.jabatan, me.unit_name);
      } else {
        return res.json(isPaginated ? { data: [], total: 0, page: 1, limit: 100, totalPages: 1 } : []);
      }
    }

    if (search) {
      whereParts.push('(name LIKE ? OR npp LIKE ? OR jabatan LIKE ? OR unit_name LIKE ?)');
      const searchParam = `%${search}%`;
      queryParams.push(searchParam, searchParam, searchParam, searchParam);
    }

    if (unit_name && unit_name !== 'all') {
      whereParts.push('unit_name = ?');
      queryParams.push(unit_name);
    }

    if (jabatan && jabatan !== 'all') {
      whereParts.push('jabatan = ?');
      queryParams.push(jabatan);
    }

    if (status && status !== 'all') {
      const st = String(status).toLowerCase();
      if (st === 'nonaktif' || st === 'non_aktif') {
        whereParts.push('status = ?');
        queryParams.push(PEGAWAI_STATUS.non_aktif);
      } else if (st === 'pensiun') {
        whereParts.push('status = ?');
        queryParams.push(PEGAWAI_STATUS.pensiun);
      } else if (st === 'pensiun_keluar') {
        whereParts.push("(status = 'pensiun' OR status = 'keluar')");
      } else if (st === 'keluar') {
        whereParts.push('status = ?');
        queryParams.push(PEGAWAI_STATUS.keluar);
      } else if (st === 'aktif') {
        whereParts.push("COALESCE(status, 'aktif') = 'aktif'");
      }
    }

    const whereStr = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';

    if (!isPaginated) {
      const [pegawai] = await db.query(`SELECT * FROM pegawai${whereStr} ORDER BY name ASC`, queryParams);
      return res.json(pegawai);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
    const offset = (pageNum - 1) * limitNum;

    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM pegawai${whereStr}`, queryParams);
    const total = countResult[0]?.total ?? 0;

    const [pegawai] = await db.query(
      `SELECT * FROM pegawai${whereStr} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    res.json({
      data: pegawai,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error('Get pegawai error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/meta/jabatan', authenticateToken, authorizeRole('admin', 'superadmin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT jabatan FROM pegawai
       WHERE jabatan IS NOT NULL AND jabatan != '' AND jabatan != '-'
       ORDER BY jabatan`
    );
    res.json(rows.map((r) => r.jabatan));
  } catch (error) {
    console.error('Get pegawai jabatan list error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

/** Ringkasan Data Pegawai untuk dashboard UI */
router.get('/stats', authenticateToken, authorizeRole('admin', 'superadmin'), async (req, res) => {
  try {
    await ensurePegawaiSchema();
    const [[totalRow]] = await db.query('SELECT COUNT(*) AS c FROM pegawai');
    const [[aktifRow]] = await db.query(
      "SELECT COUNT(*) AS c FROM pegawai WHERE COALESCE(status, 'aktif') = 'aktif'"
    );
    const [[nonaktifRow]] = await db.query(
      "SELECT COUNT(*) AS c FROM pegawai WHERE status = 'non_aktif'"
    );
    const [[pensiunRow]] = await db.query(
      "SELECT COUNT(*) AS c FROM pegawai WHERE status IN ('pensiun', 'keluar')"
    );
    const [[withUser]] = await db.query(`
      SELECT COUNT(*) AS c
      FROM pegawai p
      INNER JOIN users u ON u.pegawai_id = p.id
    `);
    const [byUnit] = await db.query(`
      SELECT unit_name AS name, COUNT(*) AS value
      FROM pegawai
      WHERE unit_name IS NOT NULL AND TRIM(unit_name) <> ''
      GROUP BY unit_name
      ORDER BY value DESC
      LIMIT 12
    `);

    res.json({
      total: totalRow?.c || 0,
      aktif: aktifRow?.c || 0,
      nonaktif: nonaktifRow?.c || 0,
      pensiun: pensiunRow?.c || 0,
      withUser: withUser?.c || 0,
      byUnit: byUnit || [],
    });
  } catch (error) {
    console.error('Pegawai stats error:', error.message);
    res.status(500).json({ message: 'Gagal memuat statistik pegawai' });
  }
});

router.put('/:id', authenticateToken, authorizeRole('admin', 'superadmin'), async (req, res) => {
  try {
    await ensurePegawaiSchema();
    const { id } = req.params;
    const isSuperadmin = req.user.role === 'superadmin';
    const { name, npp, jabatan, unit_name, status } = req.body;
    const statusVal = normalizePegawaiStatus(status);

    const [existing] = await db.query('SELECT id, npp FROM pegawai WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Pegawai tidak ditemukan' });
    }

    if (isSuperadmin) {
      if (!name?.trim() || !npp?.trim() || !jabatan?.trim() || !unit_name?.trim()) {
        return res.status(400).json({ message: 'Nama, NPP, jabatan, dan unit kantor wajib diisi' });
      }

      const [nppConflict] = await db.query(
        'SELECT id FROM pegawai WHERE npp = ? AND id != ?',
        [npp.trim(), id]
      );
      if (nppConflict.length > 0) {
        return res.status(409).json({ message: 'NPP sudah digunakan pegawai lain' });
      }

      await db.query(
        'UPDATE pegawai SET name = ?, npp = ?, jabatan = ?, unit_name = ?, status = ? WHERE id = ?',
        [name.trim(), npp.trim(), jabatan.trim(), unit_name.trim(), statusVal, id]
      );

      await db.query(
        'UPDATE users SET name = ?, npp = ?, jabatan = ?, unit_name = ? WHERE pegawai_id = ?',
        [name.trim(), npp.trim(), jabatan.trim(), unit_name.trim(), id]
      );
    } else {
      if (!jabatan?.trim() || !unit_name?.trim()) {
        return res.status(400).json({ message: 'Jabatan dan unit kantor wajib diisi' });
      }

      await db.query(
        'UPDATE pegawai SET jabatan = ?, unit_name = ?, status = ? WHERE id = ?',
        [jabatan.trim(), unit_name.trim(), statusVal, id]
      );

      await db.query(
        'UPDATE users SET jabatan = ?, unit_name = ? WHERE pegawai_id = ?',
        [jabatan.trim(), unit_name.trim(), id]
      );
    }

    const [updated] = await db.query('SELECT * FROM pegawai WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Update pegawai error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengupdate pegawai' });
  }
});

router.post('/', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    await ensurePegawaiSchema();
    const { name, npp, jabatan, unit_name, status } = req.body;
    const statusVal = normalizePegawaiStatus(status);

    if (!name?.trim() || !npp?.trim() || !jabatan?.trim() || !unit_name?.trim()) {
      return res.status(400).json({ message: 'Nama, NPP, jabatan, dan unit kantor wajib diisi' });
    }

    const [existing] = await db.query('SELECT id FROM pegawai WHERE npp = ?', [npp.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'NPP sudah terdaftar' });
    }

    const id = `peg_${Date.now()}`;
    await db.query(
      'INSERT INTO pegawai (id, name, npp, jabatan, unit_name, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name.trim(), npp.trim(), jabatan.trim(), unit_name.trim(), statusVal]
    );

    const [created] = await db.query('SELECT * FROM pegawai WHERE id = ?', [id]);
    res.status(201).json(created[0]);
  } catch (error) {
    console.error('Create pegawai error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan saat menambah pegawai' });
  }
});

router.delete('/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;

    if (id === 'admin_0') {
      return res.status(403).json({ message: 'Pegawai superadmin tidak dapat dihapus' });
    }

    const [existing] = await db.query('SELECT id, name FROM pegawai WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Pegawai tidak ditemukan' });
    }

    const [linkedUsers] = await db.query('SELECT id, role FROM users WHERE pegawai_id = ?', [id]);
    const hasSuperadminUser = linkedUsers.some(u => u.role === 'superadmin');
    if (hasSuperadminUser) {
      return res.status(403).json({ message: 'Pegawai dengan akun superadmin tidak dapat dihapus' });
    }

    if (linkedUsers.length > 0) {
      await db.query('DELETE FROM users WHERE pegawai_id = ?', [id]);
    }

    await db.query('DELETE FROM pegawai WHERE id = ?', [id]);

    res.json({ message: 'Pegawai berhasil dihapus' });
  } catch (error) {
    console.error('Delete pegawai error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan saat menghapus pegawai' });
  }
});

router.post('/sync-hris', authenticateToken, authorizeRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { inqMasterPegawaiByKondisi } = require('../lib/hris-gateway');
    const { syncPegawaiList } = require('../lib/hris-upsert');

    const hrisData = await inqMasterPegawaiByKondisi('');
    if (!Array.isArray(hrisData)) {
      throw new Error('Data HRIS tidak valid (bukan array)');
    }

    const { inserted, updated, usersCreated } = await syncPegawaiList(hrisData);
    res.json({
      message: 'Sinkronisasi berhasil',
      inserted,
      updated,
      usersCreated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal sinkronisasi data dari HRIS', error: error.message });
  }
});

module.exports = router;
