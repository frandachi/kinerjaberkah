const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');
const { generateSecret, otpauthURL, verifyTOTP, isTotpEnabled, qrDataUrl } = require('../lib/totp');

const router = express.Router();

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT totp_enabled FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }
    res.json({ enabled: isTotpEnabled(users[0]) });
  } catch (error) {
    console.error('2FA status error:', error.message);
    res.status(500).json({ message: 'Kolom MFA belum tersedia. Jalankan migrasi 004_mfa.sql' });
  }
});

router.post('/setup', authenticateToken, auditMiddleware('2FA_SETUP'), async (req, res) => {
  try {
    const secret = generateSecret();
    const username = req.user.username || req.user.npp || 'user';
    const url = otpauthURL(username, secret);

    await db.query(
      'UPDATE users SET totp_secret = ?, totp_enabled = FALSE WHERE id = ?',
      [secret, req.user.id]
    );

    const qr = await qrDataUrl(url);
    res.json({ otpauthURL: url, qr });
  } catch (error) {
    console.error('2FA setup error:', error.message);
    res.status(500).json({ message: 'Gagal menyiapkan MFA. Pastikan kolom totp_secret sudah ada.' });
  }
});

router.post('/verify', authenticateToken, auditMiddleware('2FA_VERIFY'), async (req, res) => {
  try {
    const { token } = req.body;
    const [users] = await db.query('SELECT totp_secret FROM users WHERE id = ?', [req.user.id]);

    if (users.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    if (!verifyTOTP(token, users[0].totp_secret)) {
      return res.status(400).json({ message: 'Kode OTP tidak valid' });
    }

    try {
      await db.query(
        'UPDATE users SET totp_enabled = TRUE, mfa_enrolled_at = NOW() WHERE id = ?',
        [req.user.id]
      );
    } catch (e) {
      await db.query('UPDATE users SET totp_enabled = TRUE WHERE id = ?', [req.user.id]);
    }

    res.json({ message: '2FA berhasil diaktifkan', enabled: true });
  } catch (error) {
    console.error('2FA verify error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/disable', authenticateToken, auditMiddleware('2FA_DISABLE'), async (req, res) => {
  return res.status(403).json({ message: 'MFA wajib untuk semua akun dan tidak dapat dinonaktifkan.' });
});

module.exports = router;
