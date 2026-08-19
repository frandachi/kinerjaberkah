const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');

const router = express.Router();

router.post('/setup', authenticateToken, auditMiddleware('2FA_SETUP'), async (req, res) => {
  try {
    const secret = bufferToBase32(crypto.randomBytes(20));
    const otpauthURL = `otpauth://totp/KinerjaBerkah:${req.user.username}?secret=${secret}&issuer=KinerjaBerkah`;

    await db.query(
      'UPDATE users SET totp_secret = ?, totp_enabled = FALSE WHERE id = ?',
      [secret, req.user.id]
    );

    res.json({ secret, otpauthURL });
  } catch (error) {
    console.error('2FA setup error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/verify', authenticateToken, auditMiddleware('2FA_VERIFY'), async (req, res) => {
  try {
    const { token } = req.body;
    const [users] = await db.query('SELECT totp_secret FROM users WHERE id = ?', [req.user.id]);

    if (users.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const isValid = verifyTOTP(token, users[0].totp_secret);

    if (!isValid) {
      return res.status(400).json({ message: 'Kode OTP tidak valid' });
    }

    await db.query(
      'UPDATE users SET totp_enabled = TRUE WHERE id = ?',
      [req.user.id]
    );

    res.json({ message: '2FA berhasil diaktifkan' });
  } catch (error) {
    console.error('2FA verify error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/disable', authenticateToken, auditMiddleware('2FA_DISABLE'), async (req, res) => {
  try {
    const { token } = req.body;
    const [users] = await db.query('SELECT totp_secret FROM users WHERE id = ?', [req.user.id]);

    if (users.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const isValid = verifyTOTP(token, users[0].totp_secret);

    if (!isValid) {
      return res.status(400).json({ message: 'Kode OTP tidak valid' });
    }

    await db.query(
      'UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE id = ?',
      [req.user.id]
    );

    res.json({ message: '2FA berhasil dinonaktifkan' });
  } catch (error) {
    console.error('2FA disable error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

function verifyTOTP(token, secret) {
  const timeStep = 30;
  const currentTime = Math.floor(Date.now() / 1000);
  const timeStepCounter = Math.floor(currentTime / timeStep);

  for (let i = -1; i <= 1; i++) {
    const counter = timeStepCounter + i;
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    const key = base32ToBuffer(secret);
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0x0f;
    const code = (
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)
    ) % 1000000;

    if (code.toString().padStart(6, '0') === token.toString().padStart(6, '0')) {
      return true;
    }
  }

  return false;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Node's Buffer#toString() has no 'base32' encoding, so TOTP secret
// generation needs its own RFC 4648 base32 encoder (paired with the
// base32ToBuffer decoder already used by verifyTOTP below).
function bufferToBase32(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return output;
}

function base32ToBuffer(base32) {
  const alphabet = BASE32_ALPHABET;
  let bits = 0;
  let value = 0;
  const output = [];

  for (const char of base32.toUpperCase().replace(/=/g, '')) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >> bits) & 0xff);
    }
  }

  return Buffer.from(output);
}

module.exports = router;
