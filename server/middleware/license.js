const fs = require('fs');
const path = require('path');

const EXPIRATION_DATE = new Date('2027-01-31T23:59:59');
const LICENSE_FILE = path.join(__dirname, '../license.json');

const checkLicense = (req, res, next) => {
  if (req.path === '/api/system/license' || req.path === '/api/system/license/activate') {
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
