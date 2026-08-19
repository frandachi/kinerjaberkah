const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rate-limiter');
const { auditMiddleware } = require('../middleware/audit');

const router = express.Router();

const BCRYPT_ROUNDS = 12;

const isBcryptHash = (hash) => {
  return hash && (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$'));
};

const verifyPassword = async (password, hash) => {
  if (isBcryptHash(hash)) {
    return bcrypt.compare(password, hash);
  }
  const md5Hash = crypto.createHash('md5').update(password).digest('hex');
  return md5Hash === hash;
};

const hashPassword = async (password) => {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const [users] = await db.query(
      'SELECT * FROM users WHERE username = ? OR npp = ? LIMIT 1',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const user = users[0];

    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      return res.status(423).json({ 
        message: `Akun terkunci. Silakan coba lagi setelah ${new Date(user.locked_until).toLocaleString('id-ID')}` 
      });
    }

    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
      // Periksa apakah kolom failed_attempts ada, jika tidak anggap 0
      const failCount = (user.failed_attempts !== undefined ? user.failed_attempts : 0) + 1;
      
      if (failCount >= 5) {
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
        try {
          await db.query(
            'UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?',
            [failCount, lockUntil, user.id]
          );
        } catch(e) { /* Kolom tidak ada, abaikan */ }
        return res.status(423).json({ 
          message: 'Akun terkunci selama 30 menit karena terlalu banyak percobaan gagal.' 
        });
      }

      try {
        await db.query(
          'UPDATE users SET failed_attempts = ? WHERE id = ?',
          [failCount, user.id]
        );
      } catch(e) { /* Kolom tidak ada, abaikan */ }

      return res.status(401).json({ message: 'Username atau password salah' });
    }

    try {
      await db.query(
        'UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = ?',
        [user.id]
      );
    } catch(e) {
      // Schema lokal lama belum punya kolom audit/security tambahan.
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, jabatan: user.jabatan, unit_name: user.unit_name },
      process.env.JWT_SECRET,
      { expiresIn: '2h' } // Diperketat menjadi 2 jam (sebelumnya 8 jam) untuk keamanan
    );

    delete user.password;
    delete user.failed_attempts;
    delete user.locked_until;

    res.json({ user, token });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, username, name, role, jabatan, unit_name, npp, supervisi_approval FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Auth me error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/logout', authenticateToken, auditMiddleware('LOGOUT'), (req, res) => {
  res.json({ message: 'Logout berhasil' });
});

router.put('/change-password', authenticateToken, auditMiddleware('CHANGE_PASSWORD'), async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'Password minimal 8 karakter' });
    }

    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return res.status(400).json({ 
        message: 'Password harus mengandung huruf besar, huruf kecil, dan angka' 
      });
    }

    const [users] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const isValidOld = await verifyPassword(oldPassword, users[0].password);
    if (!isValidOld) {
      return res.status(400).json({ message: 'Password lama salah' });
    }

    const [passwordHistory] = await db.query(
      'SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [req.user.id]
    );

    for (const hist of passwordHistory) {
      const isMatch = await verifyPassword(newPassword, hist.password_hash);
      if (isMatch) {
        return res.status(400).json({ message: 'Password tidak boleh sama dengan 5 password terakhir' });
      }
    }

    const hashedPassword = await hashPassword(newPassword);

    await db.query(
      'INSERT INTO password_history (id, user_id, password_hash, created_at) VALUES (?, ?, ?, NOW())',
      [`ph_${Date.now()}`, req.user.id, users[0].password]
    );

    await db.query(
      'UPDATE users SET password = ?, password_changed_at = NOW() WHERE id = ?',
      [hashedPassword, req.user.id]
    );

    res.json({ message: 'Password berhasil diubah' });
  } catch (error) {
    console.error('Change password error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/migrate-passwords', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const [users] = await db.query('SELECT id, password FROM users');
    let migrated = 0;

    for (const user of users) {
      if (!isBcryptHash(user.password)) {
        const hashedPassword = await hashPassword(user.password);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
        migrated++;
      }
    }

    res.json({ message: `Berhasil migrate ${migrated} user ke bcrypt` });
  } catch (error) {
    console.error('Migration error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
