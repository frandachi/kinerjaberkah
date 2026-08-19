const crypto = require('crypto');

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TTL_MS = 5 * 60 * 1000;
const store = new Map();

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

function pruneExpired() {
  const now = Date.now();
  for (const [id, row] of store.entries()) {
    if (row.expiresAt <= now) store.delete(id);
  }
}

function createCaptcha() {
  pruneExpired();
  const id = crypto.randomBytes(16).toString('hex');
  const text = generateText(5);
  store.set(id, {
    hash: hashAnswer(text),
    expiresAt: Date.now() + TTL_MS,
  });
  const svg = svgCaptcha(text);
  return {
    id,
    image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
  };
}

function consumeCaptcha(id, answer) {
  pruneExpired();
  const row = store.get(id);
  if (!row) return false;
  store.delete(id);
  if (row.expiresAt <= Date.now()) return false;
  if (!answer || String(answer).trim().length < 4) return false;
  return row.hash === hashAnswer(answer);
}

module.exports = { createCaptcha, consumeCaptcha };
