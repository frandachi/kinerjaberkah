const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const accessLogStream = fs.createWriteStream(
  path.join(logDir, 'access.log'),
  { flags: 'a' }
);

const errorLogStream = fs.createWriteStream(
  path.join(logDir, 'error.log'),
  { flags: 'a' }
);

const accessLogger = morgan('combined', { stream: accessLogStream });

const errorLogger = (err, req, res, next) => {
  const logEntry = `${new Date().toISOString()} [ERROR] ${err.message}\n${err.stack}\n---\n`;
  errorLogStream.write(logEntry);
  next(err);
};

module.exports = { accessLogger, errorLogger };
