const jwt = require('jsonwebtoken');
const db = require('../db');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Akses ditolak. Token tidak ditemukan.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    // 401 (bukan 403): FE sudah clear token + redirect login pada 401.
    // Token expired/invalid setelah refresh sering terlihat sebagai "page gagal".
    if (err) {
      return res.status(401).json({ message: 'Token tidak valid atau sudah kadaluarsa.' });
    }

    if (user && (user.purpose === 'mfa' || user.purpose === 'mfa-enroll')) {
      return res.status(403).json({ message: 'Selesaikan verifikasi MFA terlebih dahulu.' });
    }
    
    db.query('SELECT status FROM users WHERE id = ? LIMIT 1', [user.id])
      .then(([rows]) => {
        const status = String((rows[0] && rows[0].status) || '').toLowerCase();
        if (status === 'nonaktif') {
          return res.status(403).json({ message: 'Akun nonaktif. Hubungi administrator.' });
        }
        req.user = user;
        next();
      })
      .catch(() => {
        req.user = user;
        next();
      });
  });
};

module.exports = authenticateToken;
