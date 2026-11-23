const crypto = require('crypto');

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TTL_MS = 5 * 60 * 1000;
// Stateless signed captcha: aman multi-worker Passenger, tanpa file/store bersama.
const usedIds = new Map(); // anti-replay lokal (best-effort)

function secret() {
  return process.env.JWT_SECRET || process.env.CAPTCHA_SECRET || 'kb-captcha-fallback';
}

function hashAnswer(value) {
  return crypto.createHash('sha256').update(String(value).trim().toUpperCase()).digest('hex');
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomChar() {
  return CHARSET[randomInt(0, CHARSET.length - 1)];
}

function generateText(length = 5) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += randomChar();
  return out;
}

function svgCaptcha(text) {
  const width = 180;
  const height = 56;
  const chars = [...text];
  const letters = chars.map((ch, i) => {
    const x = 18 + i * 32 + randomInt(-3, 3);
    const y = randomInt(34, 42);
    const rotate = randomInt(-28, 28);
    const fill = `rgb(${randomInt(20, 70)},${randomInt(40, 90)},${randomInt(110, 170)})`;
    return `<text x="${x}" y="${y}" fill="${fill}" font-size="${randomInt(24, 30)}" font-family="Arial,sans-serif" font-weight="700" transform="rotate(${rotate} ${x} ${y})">${ch}</text>`;
  }).join('');

  const lines = Array.from({ length: 5 }, () => {
    const x1 = randomInt(0, width);
    const y1 = randomInt(0, height);
    const x2 = randomInt(0, width);
    const y2 = randomInt(0, height);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(15,23,42,0.28)" stroke-width="${randomInt(1, 2)}" />`;
  }).join('');

  const dots = Array.from({ length: 18 }, () => {
    const cx = randomInt(2, width - 2);
    const cy = randomInt(2, height - 2);
    return `<circle cx="${cx}" cy="${cy}" r="1.2" fill="rgba(15,23,42,0.25)" />`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="captcha">
    <rect width="100%" height="100%" fill="#f8fafc"/>
    ${dots}${lines}${letters}
  </svg>`;
}

function sign(payloadB64) {
  return crypto.createHmac('sha256', secret()).update(payloadB64).digest('base64url');
}

function pruneUsed() {
  const now = Date.now();
  for (const [id, exp] of usedIds.entries()) {
    if (exp <= now) usedIds.delete(id);
  }
}

function createCaptcha() {
  pruneUsed();
  const text = generateText(5);
  const payload = {
    h: hashAnswer(text),
    e: Date.now() + TTL_MS,
    n: crypto.randomBytes(8).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const id = `${payloadB64}.${sign(payloadB64)}`;
  const svg = svgCaptcha(text);
  return {
    id,
    image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  };
}

function consumeCaptcha(id, answer) {
  pruneUsed();
  if (!id || typeof id !== 'string' || !id.includes('.')) return false;
  if (usedIds.has(id)) return false;
  const [payloadB64, sig] = id.split('.');
  if (!payloadB64 || !sig || sign(payloadB64) !== sig) return false;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return false;
  }
  if (!payload || !payload.h || !payload.e || payload.e <= Date.now()) return false;
  if (!answer || String(answer).trim().length < 4) return false;
  const ok = payload.h === hashAnswer(answer);
  if (ok) usedIds.set(id, payload.e);
  return ok;
}

module.exports = { createCaptcha, consumeCaptcha };
