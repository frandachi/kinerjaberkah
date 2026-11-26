const db = require('../db');

async function roleHasPermission(role, moduleName, action) {
  if (!role || role === 'superadmin') return true;

  const key = `${role}::${moduleName}::${action}`;
  try {
    const [rows] = await db.query(
      'SELECT permissions FROM role_permissions WHERE role_id = ? LIMIT 1',
      [role]
    );
    if (rows.length) {
      let perms = rows[0].permissions;
      if (typeof perms === 'string') {
        try {
          perms = JSON.parse(perms);
        } catch {
          perms = {};
        }
      }
      if (perms && typeof perms === 'object' && Object.prototype.hasOwnProperty.call(perms, key)) {
        return !!perms[key];
      }
    }
  } catch (err) {
    console.warn('roleHasPermission:', err.message);
  }

  // Default mirror UI Role & Hak Akses (Aa):
  // admin: semua kecuali delete; user: view/add/edit
  if (role === 'admin') return action !== 'delete';
  return action === 'view' || action === 'add' || action === 'edit';
}

function requirePermission(moduleName, action) {
  return async (req, res, next) => {
    try {
      const ok = await roleHasPermission(req.user?.role, moduleName, action);
      if (!ok) {
        return res.status(403).json({
          message: `Anda tidak memiliki izin ${action} pada ${moduleName}.`,
        });
      }
      next();
    } catch (err) {
      console.error('requirePermission error:', err.message);
      return res.status(500).json({ message: 'Gagal memverifikasi izin akses.' });
    }
  };
}

function requireAnyPermission(moduleName, actions) {
  const list = Array.isArray(actions) ? actions : [actions];
  return async (req, res, next) => {
    try {
      for (const action of list) {
        if (await roleHasPermission(req.user?.role, moduleName, action)) {
          return next();
        }
      }
      return res.status(403).json({
        message: `Anda tidak memiliki izin pada ${moduleName}.`,
      });
    } catch (err) {
      console.error('requireAnyPermission error:', err.message);
      return res.status(500).json({ message: 'Gagal memverifikasi izin akses.' });
    }
  };
}

module.exports = requirePermission;
module.exports.roleHasPermission = roleHasPermission;
module.exports.requireAnyPermission = requireAnyPermission;
