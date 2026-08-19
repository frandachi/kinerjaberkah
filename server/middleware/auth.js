const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Akses ditolak. Token tidak ditemukan.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token tidak valid atau sudah kadaluarsa.' });
    }

    if (user && user.purpose === 'mfa') {
      return res.status(403).json({ message: 'Selesaikan verifikasi MFA terlebih dahulu.' });
    }
    
    req.user = user;
    next();
  });
};

module.exports = authenticateToken;
