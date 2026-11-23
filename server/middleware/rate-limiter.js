const rateLimit = require('express-rate-limit');

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Login: no IP throttle — many users share one office NAT and hit this immediately.
// Account lockout after failed passwords (auth.js) still applies per-user.
const loginLimiter = (req, res, next) => next();

// Default production: 600 / 5 menit / IP (kantor sering 1 IP NAT bersama).
// Staging load-test: set API_RATE_MAX tinggi (mis. 100000) selama jendela uji.
const apiLimiter = rateLimit({
  windowMs: envInt('API_RATE_WINDOW_MS', 5 * 60 * 1000),
  max: envInt('API_RATE_MAX', 2000),
  message: { message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
  standardHeaders: true,
  legacyHeaders: false
});

const activateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Terlalu banyak percobaan aktivasi. Silakan coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Captcha punya limiter sendiri; default longgar karena refresh gambar sering.
// Staging load-test 2400 VU: set CAPTCHA_RATE_MAX=100000 selama jendela uji.
const captchaLimiter = rateLimit({
  windowMs: envInt('CAPTCHA_RATE_WINDOW_MS', 5 * 60 * 1000),
  max: envInt('CAPTCHA_RATE_MAX', 600),
  message: { message: 'Terlalu banyak permintaan captcha. Silakan coba lagi nanti.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, apiLimiter, activateLimiter, captchaLimiter };
