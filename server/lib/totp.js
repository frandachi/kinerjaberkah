const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

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
  let bits = 0;
  let value = 0;
  const output = [];

  for (const char of String(base32 || '').toUpperCase().replace(/=/g, '')) {
    const idx = BASE32_ALPHABET.indexOf(char);
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

function generateSecret() {
  return bufferToBase32(crypto.randomBytes(20));
}

function otpauthURL(username, secret) {
  const label = encodeURIComponent(`KinerjaBerkah:${username}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=KinerjaBerkah&algorithm=SHA1&digits=6&period=30`;
}

function verifyTOTP(token, secret) {
  if (!token || !secret) return false;

  const expected = String(token).replace(/\s/g, '').padStart(6, '0');
  if (!/^\d{6}$/.test(expected)) return false;

  const timeStep = 30;
  const currentTime = Math.floor(Date.now() / 1000);
  const timeStepCounter = Math.floor(currentTime / timeStep);

  for (let i = -1; i <= 1; i++) {
    const counter = timeStepCounter + i;
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', base32ToBuffer(secret));
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0x0f;
    const code = (
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)
    ) % 1000000;

    if (code.toString().padStart(6, '0') === expected) {
      return true;
    }
  }

  return false;
}

function isTotpEnabled(user) {
  return Boolean(user && (user.totp_enabled === 1 || user.totp_enabled === true || user.totp_enabled === '1'));
}

function sanitizeUser(user) {
  if (!user) return user;
  const copy = { ...user };
  delete copy.password;
  delete copy.failed_attempts;
  delete copy.locked_until;
  delete copy.totp_secret;
  copy.totp_enabled = isTotpEnabled(user);
  return copy;
}

module.exports = {
  generateSecret,
  otpauthURL,
  verifyTOTP,
  isTotpEnabled,
  sanitizeUser,
};
