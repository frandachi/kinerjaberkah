async function assertPegawaiAccess(req, res, db, pegawaiId) {
  if (req.user.role === 'superadmin' || req.user.role === 'admin') {
    return true;
  }

  const [users] = await db.query('SELECT pegawai_id FROM users WHERE id = ? LIMIT 1', [req.user.id]);
  if (users.length === 0 || users[0].pegawai_id !== pegawaiId) {
    res.status(403).json({ message: 'Anda tidak memiliki izin untuk mengakses data pegawai ini' });
    return false;
  }

  return true;
}

module.exports = { assertPegawaiAccess };
