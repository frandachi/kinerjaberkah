const fs = require('fs');
const path = require('path');

const EXPIRATION_DATE = new Date('2027-01-31T23:59:59');
const LICENSE_FILE = path.join(__dirname, '../license.json');

const PUBLIC_PATHS = new Set([
  '/api/health',
  '/api/system/license',
  '/api/system/license/activate',
  '/api/system/public-summary',
  '/api/auth/login',
  '/api/auth/login/2fa',
  '/api/auth/captcha',
  '/api/auth/login/mfa-setup',
  '/api/auth/login/mfa-activate',
]);

const checkLicense = (req, res, next) => {
  const p = (req.path || '').split('?')[0];
  if (PUBLIC_PATHS.has(p)) {
    return next();
  }
  
  const now = new Date();
  if (now > EXPIRATION_DATE) {
    if (fs.existsSync(LICENSE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
        if (data.activated === true && data.token === process.env.ACTIVATION_TOKEN) {
          return next();
        }
      } catch (e) {}
    }
    
    return res.status(403).json({ 
      error: 'LICENSE_EXPIRED', 
      message: 'Masa aktif aplikasi telah habis. Silakan hubungi administrator.' 
    });
  }
  
  next();
};

module.exports = checkLicense;
