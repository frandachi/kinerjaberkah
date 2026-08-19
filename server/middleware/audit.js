const db = require('../db');

const logActivity = async (userId, action, details, ipAddress) => {
  try {
    const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.query(
      'INSERT INTO activity_logs (id, user_id, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [id, userId, action, JSON.stringify(details), ipAddress || 'unknown']
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

const auditMiddleware = (action) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    
    res.json = function(body) {
      if (req.user && res.statusCode < 400) {
        logActivity(
          req.user.id,
          action,
          { ...body, params: req.params, query: req.query, body: req.body },
          req.ip
        );
      }
      return originalJson(body);
    };

    next();
  };
};

module.exports = { logActivity, auditMiddleware };
