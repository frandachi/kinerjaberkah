const db = require('../db');

/**
 * Catat aktivitas ke activity_logs (user_name/user_role diisi agar Audit Trail terbaca).
 */
const logActivity = async (userOrId, action, details, ipAddress, userMeta = null) => {
  try {
    let userId = userOrId;
    let userName = userMeta && userMeta.name != null ? userMeta.name : null;
    let userRole = userMeta && userMeta.role != null ? userMeta.role : null;

    if (userOrId && typeof userOrId === 'object') {
      userId = userOrId.id;
      userName = userOrId.name || userOrId.username || userName;
      userRole = userOrId.role || userRole;
    }

    if ((!userName || !userRole) && userId) {
      try {
        const [rows] = await db.query(
          'SELECT name, username, role FROM users WHERE id = ? LIMIT 1',
          [userId]
        );
        if (rows[0]) {
          userName = userName || rows[0].name || rows[0].username || null;
          userRole = userRole || rows[0].role || null;
        }
      } catch (_) { /* ignore */ }
    }

    let detailStr = details;
    if (details != null && typeof details !== 'string') {
      try { detailStr = JSON.stringify(details); } catch (_) { detailStr = String(details); }
    }

    await db.query(
      `INSERT INTO activity_logs (user_id, user_name, user_role, action, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [userId || null, userName, userRole, action, detailStr || null, ipAddress || 'unknown']
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

const auditMiddleware = (action) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      if (req.user && res.statusCode < 400) {
        const safeBody = body && typeof body === 'object'
          ? { message: body.message || body._message || undefined }
          : { ok: true };
        logActivity(
          req.user,
          action,
          { ...safeBody, params: req.params, query: req.query, body: sanitizeBody(req.body) },
          req.ip || req.headers['x-forwarded-for'] || 'unknown'
        );
      }
      return originalJson(body);
    };

    next();
  };
};

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const out = { ...body };
  for (const key of Object.keys(out)) {
    if (/password|token|secret|captcha|fileBase64|base64/i.test(key)) out[key] = '[redacted]';
  }
  return out;
}

module.exports = { logActivity, auditMiddleware };
