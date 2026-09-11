const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorize');
const { auditMiddleware } = require('../middleware/audit');
const { planAtasanSync } = require('../lib/atasanLangsung');

const router = express.Router();
const BCRYPT_ROUNDS = 12;

const isBcryptHash = (hash) => {
  return hash && (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$'));
};

router.get('/', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { search = '', page = '1', limit = '100', unit_name = '' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = [];
    const queryParams = [];

    if (search) {
      whereClauses.push('(name LIKE ? OR username LIKE ? OR npp LIKE ?)');
      const searchParam = `%${search}%`;
      queryParams.push(searchParam, searchParam, searchParam);
    }

    if (unit_name) {
      whereClauses.push('LOWER(unit_name) = LOWER(?)');
      queryParams.push(unit_name);
    }

    const whereStr = whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '';

    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM users${whereStr}`, queryParams);
    const total = countResult[0]?.total ?? 0;

    const [users] = await db.query(
      `SELECT id, username, name, role, jabatan, unit_name, npp, supervisi_approval, created_at, last_login FROM users${whereStr} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    res.json({
      data: users,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error('Get users error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

/** Ringkasan jumlah users vs pegawai (sumber kebenaran = pegawai) */
router.get('/stats', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const [[u]] = await db.query('SELECT COUNT(*) AS c FROM users');
    const [[p]] = await db.query('SELECT COUNT(*) AS c FROM pegawai');
    // Sumber kebenaran: setiap pegawai harus punya user dengan pegawai_id = pegawai.id
    const [[missing]] = await db.query(`
      SELECT COUNT(*) AS c
      FROM pegawai p
      LEFT JOIN users u ON u.pegawai_id = p.id
      WHERE u.id IS NULL
    `);
    const [[locked]] = await db.query(`
      SELECT COUNT(*) AS c FROM users
      WHERE locked_until IS NOT NULL AND locked_until > NOW()
    `).catch(() => [[{ c: 0 }]]);

    const totalUsers = u?.c || 0;
    const totalPegawai = p?.c || 0;
    const missingUsers = missing?.c || 0;
    const lockedCount = locked?.c || 0;

    res.json({
      totalUsers,
      totalPegawai,
      missingUsers,
      locked: lockedCount,
      nonaktif: 0,
      aktif: Math.max(0, totalUsers - lockedCount),
      synced: missingUsers === 0 && totalUsers >= totalPegawai,
    });
  } catch (error) {
    console.error('Users stats error:', error.message);
    res.status(500).json({ message: 'Gagal memuat statistik pengguna' });
  }
});

/**
 * Buat akun user untuk setiap pegawai yang belum punya user.
 * Username/password default = NPP (atau id pegawai jika NPP kosong).
 */
router.post(
  '/sync-from-pegawai',
  authenticateToken,
  authorizeRole('superadmin'),
  auditMiddleware('SYNC_USERS_FROM_PEGAWAI'),
  async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT p.id, p.name, p.npp, p.jabatan, p.unit_name
        FROM pegawai p
        LEFT JOIN users u ON u.pegawai_id = p.id
        WHERE u.id IS NULL
      `);

      let created = 0;
      let skipped = 0;
      const errors = [];

      for (const p of rows) {
        const npp = String(p.npp || '').trim();
        const usernameBase = npp || String(p.id).replace(/^peg_/, '') || `u${Date.now()}`;
        let username = usernameBase;
        let attempt = 0;
        // Username harus unik; NPP boleh sama jika ada duplikat data pegawai
        while (attempt < 8) {
          const [exists] = await db.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
          if (!exists.length) break;
          attempt += 1;
          username = `${usernameBase}_${attempt}`;
        }
        if (attempt >= 8) {
          skipped += 1;
          errors.push({ id: p.id, reason: 'username bentrok' });
          continue;
        }

        const passwordSeed = npp || username;
        const padded = passwordSeed.length >= 8
          ? passwordSeed
          : (passwordSeed + '00000000').slice(0, 8);

        try {
          const hashedPassword = await bcrypt.hash(padded, BCRYPT_ROUNDS);
          const id = `user_${Date.now()}_${created}_${Math.random().toString(36).slice(2, 7)}`;
          let nppValue = npp || username;
          try {
            await db.query(
              `INSERT INTO users
                (id, pegawai_id, name, username, password, jabatan, unit_name, role, supervisi_approval, npp)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'user', '', ?)`,
              [
                id,
                p.id,
                p.name || username,
                username,
                hashedPassword,
                p.jabatan || '',
                p.unit_name || '',
                nppValue,
              ]
            );
          } catch (dupErr) {
            // Jika npp UNIQUE bentrok, pakai suffix
            if (String(dupErr.message || '').toLowerCase().includes('duplicate')) {
              nppValue = `${nppValue}_${created + 1}`;
              await db.query(
                `INSERT INTO users
                  (id, pegawai_id, name, username, password, jabatan, unit_name, role, supervisi_approval, npp)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'user', '', ?)`,
                [
                  id,
                  p.id,
                  p.name || username,
                  username,
                  hashedPassword,
                  p.jabatan || '',
                  p.unit_name || '',
                  nppValue,
                ]
              );
            } else {
              throw dupErr;
            }
          }
          created += 1;
        } catch (e) {
          skipped += 1;
          errors.push({ id: p.id, reason: e.message });
        }
      }

      const [[u]] = await db.query('SELECT COUNT(*) AS c FROM users');
      const [[pg]] = await db.query('SELECT COUNT(*) AS c FROM pegawai');

      res.json({
        message: `Sinkronisasi selesai: ${created} user dibuat`,
        created,
        skipped,
        totalUsers: u?.c || 0,
        totalPegawai: pg?.c || 0,
        errors: errors.slice(0, 20),
      });
    } catch (error) {
      console.error('Sync users from pegawai error:', error.message);
      res.status(500).json({ message: 'Gagal sinkronisasi: ' + error.message });
    }
  }
);

router.post('/', authenticateToken, authorizeRole('superadmin'), auditMiddleware('CREATE_USER'), async (req, res) => {
  try {
    const { name, username, password, jabatan, unit_name, role, supervisi_approval, npp } = req.body;

    if (!username || !name) {
      return res.status(400).json({ message: 'Username dan nama wajib diisi' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password wajib diisi minimal 8 karakter' });
    }

    const [existingUsers] = await db.query('SELECT id FROM users WHERE username = ? OR npp = ?', [username, npp || username]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Username atau NPP sudah terdaftar' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = `user_${Date.now()}`;
    const pegawai_id = `peg_${Date.now()}`;

    await db.query(
      'INSERT INTO pegawai (id, name, npp, jabatan, unit_name) VALUES (?, ?, ?, ?, ?)',
      [pegawai_id, name || '', npp || username || '', jabatan || '', unit_name || '']
    );

    await db.query(
      'INSERT INTO users (id, pegawai_id, name, username, password, jabatan, unit_name, role, supervisi_approval, npp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, pegawai_id, name || '', username || '', hashedPassword, jabatan || '', unit_name || '', role || 'user', supervisi_approval || '', npp || username || '']
    );

    const [users] = await db.query(
      'SELECT id, username, name, role, jabatan, unit_name, npp, supervisi_approval, created_at FROM users WHERE id = ?',
      [id]
    );

    res.status(201).json(users[0]);
  } catch (error) {
    console.error('Create user error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.put('/:id', authenticateToken, authorizeRole('superadmin'), auditMiddleware('UPDATE_USER'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, password, jabatan, unit_name, role, supervisi_approval, npp } = req.body;

    const [existingUsers] = await db.query('SELECT pegawai_id, role FROM users WHERE id = ?', [id]);
    if (existingUsers.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const pegawai_id = existingUsers[0].pegawai_id;
    const nextRole = role === undefined || role === null || role === ''
      ? existingUsers[0].role
      : role;

    await db.query(
      'UPDATE pegawai SET name=?, npp=?, jabatan=?, unit_name=? WHERE id=?',
      [name || '', npp || username || '', jabatan || '', unit_name || '', pegawai_id]
    );

    if (password) {
      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await db.query(
        'UPDATE users SET name=?, username=?, password=?, jabatan=?, unit_name=?, role=?, supervisi_approval=?, npp=? WHERE id=?',
        [name || '', username || '', hashedPassword, jabatan || '', unit_name || '', nextRole, supervisi_approval || '', npp || username || '', id]
      );
    } else {
      await db.query(
        'UPDATE users SET name=?, username=?, jabatan=?, unit_name=?, role=?, supervisi_approval=?, npp=? WHERE id=?',
        [name || '', username || '', jabatan || '', unit_name || '', nextRole, supervisi_approval || '', npp || username || '', id]
      );
    }

    const [users] = await db.query(
      'SELECT id, username, name, role, jabatan, unit_name, npp, supervisi_approval FROM users WHERE id = ?',
      [id]
    );

    res.json(users[0]);
  } catch (error) {
    console.error('Update user error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.delete('/:id', authenticateToken, authorizeRole('superadmin'), auditMiddleware('DELETE_USER'), async (req, res) => {
  try {
    const { id } = req.params;

    const [existingUsers] = await db.query('SELECT pegawai_id FROM users WHERE id = ?', [id]);
    if (existingUsers.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    await db.query('DELETE FROM users WHERE id = ?', [id]);
    await db.query('DELETE FROM pegawai WHERE id = ?', [existingUsers[0].pegawai_id]);

    res.json({ message: 'User berhasil dihapus' });
  } catch (error) {
    console.error('Delete user error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});


router.post('/sync-atasan-langsung', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('SYNC_ATASAN_LANGSUNG'), async (req, res) => {
  try {
    const onlyEmpty = !!(req.body && req.body.onlyEmpty);
    const dryRun = !!(req.body && req.body.dryRun);
    const [users] = await db.query(
      'SELECT id, name, npp, jabatan, unit_name, supervisi_approval FROM users WHERE role != ?',
      ['superadmin']
    );
    const { updates, unresolved, skipped } = planAtasanSync(users, { onlyEmpty });

    if (!dryRun && updates.length > 0) {
      for (const row of updates) {
        await db.query('UPDATE users SET supervisi_approval = ? WHERE id = ?', [row.to, row.id]);
      }
    }

    res.json({
      message: dryRun
        ? 'Preview pemetaan atasan dari struktur organisasi'
        : 'Atasan langsung disesuaikan dari struktur organisasi',
      dryRun,
      onlyEmpty,
      updated: dryRun ? 0 : updates.length,
      planned: updates.length,
      unresolved,
      skipped,
      samples: updates.slice(0, 20),
    });
  } catch (error) {
    console.error('Sync atasan langsung error:', error.message);
    res.status(500).json({ message: 'Gagal menyesuaikan atasan langsung' });
  }
});

router.post('/update-supervisor', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('UPDATE_SUPERVISOR'), async (req, res) => {
  try {
    const { npp, supervisi_approval } = req.body;

    if (!npp) {
      return res.status(400).json({ message: 'NPP wajib diisi' });
    }

    await db.query('UPDATE users SET supervisi_approval = ? WHERE npp = ?', [supervisi_approval || '', npp]);

    res.json({ message: 'Supervisor berhasil diperbarui' });
  } catch (error) {
    console.error('Update supervisor error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
