const rateLimit = require('express-rate-limit');

// Login: no IP throttle — many users share one office NAT and hit this immediately.
// Account lockout after failed passwords (auth.js) still applies per-user.
const loginLimiter = (req, res, next) => next();

const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 200,
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

const captchaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  message: { message: 'Terlalu banyak permintaan captcha. Silakan coba lagi nanti.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, apiLimiter, activateLimiter, captchaLimiter };
