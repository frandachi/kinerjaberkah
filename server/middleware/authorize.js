const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Akses ditolak. Silakan login terlebih dahulu.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Anda tidak memiliki izin untuk mengakses halaman ini.' });
    }

    next();
  };
};

module.exports = authorizeRole;
