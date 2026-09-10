const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { loginLimiter, captchaLimiter } = require('../middleware/rate-limiter');
const { auditMiddleware } = require('../middleware/audit');
const { verifyTOTP, isTotpEnabled, sanitizeUser, generateSecret, otpauthURL, qrDataUrl } = require('../lib/totp');
const { createCaptcha, consumeCaptcha } = require('../lib/captcha');
const { authLogin } = require('../lib/hris-gateway');
const { upsertFromHrisLogin } = require('../lib/hris-upsert');

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

const LOCK_EXEMPT_LOGINS = new Set(['1542']);

function isLockExemptUser(userOrLogin) {
  if (!userOrLogin) return false;
  if (typeof userOrLogin === 'string') {
    return LOCK_EXEMPT_LOGINS.has(String(userOrLogin).trim());
  }
  const candidates = [userOrLogin.username, userOrLogin.npp]
    .filter((v) => v != null)
    .map((v) => String(v).trim());
  return candidates.some((v) => LOCK_EXEMPT_LOGINS.has(v));
}

async function issueSession(res, user) {
  try {
    await db.query(
      'UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = ?',
      [user.id]
    );
  } catch (e) {
    // Schema lokal lama belum punya kolom audit/security tambahan.
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, jabatan: user.jabatan, unit_name: user.unit_name },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  res.json({ user: sanitizeUser(user), token });
}

function signMfaToken(user, purpose, expiresIn) {
  return jwt.sign(
    { id: user.id, username: user.username, purpose },
    process.env.JWT_SECRET,
    { expiresIn }
  );
}

function readMfaToken(mfaToken, purpose) {
  const payload = jwt.verify(mfaToken, process.env.JWT_SECRET);
  if (!payload || payload.purpose !== purpose || !payload.id) {
    const err = new Error('Token MFA tidak valid');
    err.status = 401;
    throw err;
  }
  return payload;
}

router.get('/captcha', captchaLimiter, (req, res) => {
  res.json(createCaptcha());
});

function respondMfaGate(res, user) {
  if (isTotpEnabled(user)) {
    return res.json({
      requires2FA: true,
      mfaToken: signMfaToken(user, 'mfa', '5m'),
      message: 'Masukkan kode MFA dari aplikasi authenticator',
    });
  }

  return res.json({
    requiresMFASetup: true,
    mfaToken: signMfaToken(user, 'mfa-enroll', '10m'),
    message: 'MFA wajib. Aktifkan authenticator untuk melanjutkan.',
  });
}

async function rejectFailedLogin(res, user) {
  if (isLockExemptUser(user)) {
    return res.status(401).json({ message: 'Username atau password salah' });
  }

  const failCount = (user.failed_attempts !== undefined ? user.failed_attempts : 0) + 1;

  if (failCount >= 5) {
    const lockUntil = new Date(Date.now() + 5 * 60 * 1000);
    try {
      await db.query(
        'UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?',
        [failCount, lockUntil, user.id]
      );
    } catch (e) { /* Kolom tidak ada, abaikan */ }
    return res.status(423).json({
      message: 'Akun terkunci selama 5 menit karena terlalu banyak percobaan gagal.',
    });
  }

  try {
    await db.query(
      'UPDATE users SET failed_attempts = ? WHERE id = ?',
      [failCount, user.id]
    );
  } catch (e) { /* Kolom tidak ada, abaikan */ }

  return res.status(401).json({ message: 'Username atau password salah' });
}

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password, captchaId, captcha } = req.body;

  try {
    if (!consumeCaptcha(captchaId, captcha)) {
      return res.status(400).json({ message: 'Captcha tidak valid. Silakan muat ulang gambar.' });
    }

    let user = null;

    try {
      const hrisRows = await authLogin({ username, password });
      if (hrisRows && hrisRows.length > 0) {
        const upserted = await upsertFromHrisLogin(hrisRows[0], password);
        user = upserted.user;
      }
    } catch (hrisError) {
      console.warn('HRIS authLogin fallback to local:', hrisError.message);
    }

    if (!user) {
      const [users] = await db.query(
        'SELECT * FROM users WHERE username = ? OR npp = ? LIMIT 1',
        [username, username]
      );

      if (users.length === 0) {
        return res.status(401).json({ message: 'Username atau password salah' });
      }

      user = users[0];

      if (
        !isLockExemptUser(user) &&
        user.locked_until &&
        new Date() < new Date(user.locked_until)
      ) {
        return res.status(423).json({
          message: `Akun terkunci. Silakan coba lagi setelah ${new Date(user.locked_until).toLocaleString('id-ID')}`,
        });
      }

      if (isLockExemptUser(user) && (user.locked_until || user.failed_attempts)) {
        try {
          await db.query(
            'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?',
            [user.id]
          );
        } catch (e) { /* Kolom tidak ada, abaikan */ }
        user.failed_attempts = 0;
        user.locked_until = null;
      }

      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        return rejectFailedLogin(res, user);
      }
    } else if (
      !isLockExemptUser(user) &&
      user.locked_until &&
      new Date() < new Date(user.locked_until)
    ) {
      return res.status(423).json({
        message: `Akun terkunci. Silakan coba lagi setelah ${new Date(user.locked_until).toLocaleString('id-ID')}`,
      });
    }

    return respondMfaGate(res, user);
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/login/2fa', loginLimiter, async (req, res) => {
  const { mfaToken, token, code } = req.body;
  const otp = token || code;

  try {
    if (!mfaToken || !otp) {
      return res.status(400).json({ message: 'Kode MFA wajib diisi' });
    }

    let payload;
    try {
      payload = jwt.verify(mfaToken, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ message: 'Sesi MFA berakhir. Silakan login ulang.' });
    }

    if (payload.purpose !== 'mfa' || !payload.id) {
      return res.status(401).json({ message: 'Token MFA tidak valid' });
    }

    const [users] = await db.query('SELECT * FROM users WHERE id = ? LIMIT 1', [payload.id]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'User tidak ditemukan' });
    }

    const user = users[0];
    if (!isTotpEnabled(user) || !verifyTOTP(otp, user.totp_secret)) {
      return res.status(401).json({ message: 'Kode MFA tidak valid' });
    }

    return issueSession(res, user);
  } catch (error) {
    console.error('Login 2FA error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/login/mfa-setup', loginLimiter, async (req, res) => {
  try {
    const payload = readMfaToken(req.body.mfaToken, 'mfa-enroll');
    const [users] = await db.query('SELECT id, username, npp FROM users WHERE id = ? LIMIT 1', [payload.id]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'User tidak ditemukan' });
    }

    const secret = generateSecret();
    const username = users[0].username || users[0].npp || payload.username || 'user';
    const url = otpauthURL(username, secret);
    await db.query(
      'UPDATE users SET totp_secret = ?, totp_enabled = FALSE WHERE id = ?',
      [secret, payload.id]
    );

    const qr = await qrDataUrl(url);
    res.json({ otpauthURL: url, qr });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.status === 401) {
      return res.status(401).json({ message: 'Sesi MFA berakhir. Silakan login ulang.' });
    }
    console.error('MFA setup error:', error.message);
    const hint = /qrcode/i.test(error.message || '')
      ? 'Pasang dependency: npm install qrcode (di folder server).'
      : /Unknown column|ER_BAD_FIELD/i.test(error.message || '')
        ? 'Jalankan migrasi 005_mfa_required.sql'
        : 'Cek log server (MFA setup error).';
    res.status(500).json({ message: `Gagal menyiapkan MFA. ${hint}` });
  }
});

router.post('/login/mfa-activate', loginLimiter, async (req, res) => {
  const otp = req.body.token || req.body.code;
  try {
    if (!otp) {
      return res.status(400).json({ message: 'Kode MFA wajib diisi' });
    }

    const payload = readMfaToken(req.body.mfaToken, 'mfa-enroll');
    const [users] = await db.query('SELECT * FROM users WHERE id = ? LIMIT 1', [payload.id]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'User tidak ditemukan' });
    }

    const user = users[0];
    if (!verifyTOTP(otp, user.totp_secret)) {
      return res.status(401).json({ message: 'Kode MFA tidak valid' });
    }

    try {
      await db.query(
        'UPDATE users SET totp_enabled = TRUE, mfa_enrolled_at = NOW() WHERE id = ?',
        [user.id]
      );
    } catch (e) {
      await db.query('UPDATE users SET totp_enabled = TRUE WHERE id = ?', [user.id]);
    }
    user.totp_enabled = true;
    return issueSession(res, user);
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.status === 401) {
      return res.status(401).json({ message: 'Sesi MFA berakhir. Silakan login ulang.' });
    }
    console.error('MFA activate error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    let users;
    try {
      [users] = await db.query(
        'SELECT id, username, name, role, jabatan, unit_name, npp, supervisi_approval, totp_enabled FROM users WHERE id = ?',
        [req.user.id]
      );
    } catch (e) {
      [users] = await db.query(
        'SELECT id, username, name, role, jabatan, unit_name, npp, supervisi_approval FROM users WHERE id = ?',
        [req.user.id]
      );
    }

    if (users.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    res.json({ user: sanitizeUser(users[0]) });
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
