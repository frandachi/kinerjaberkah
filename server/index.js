require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const db = require('./db');
const checkLicense = require('./middleware/license');
const { apiLimiter } = require('./middleware/rate-limiter');
const { accessLogger, errorLogger } = require('./middleware/logger');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const kpiRoutes = require('./routes/kpis');
const pegawaiRoutes = require('./routes/pegawai');
const parameterRoutes = require('./routes/parameters');
const mutationRoutes = require('./routes/mutations');
const lookupRoutes = require('./routes/lookups');
const systemRoutes = require('./routes/system');
const twoFARoutes = require('./routes/2fa');
const makerCheckerRoutes = require('./routes/maker-checker');
const pdfRoutes = require('./routes/pdf');
const httpsRedirect = require('./middleware/https-redirect');

const app = express();

// Required so req.secure / X-Forwarded-Proto is read correctly behind the
// Apache + Passenger reverse proxy; without this, httpsRedirect below always
// sees req.secure === false in production and creates a redirect loop.
app.set('trust proxy', 1);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'fallback_secret_key_change_in_production') {
  console.error('FATAL: JWT_SECRET must be set in environment variables');
  process.exit(1);
}

// if (!process.env.DB_PASS || process.env.DB_PASS === '') {
//   console.error('FATAL: DB_PASS must be set in environment variables');
//   process.exit(1);
// }

app.use(httpsRedirect);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

const originSource = [process.env.ALLOWED_ORIGINS, process.env.CORS_ORIGIN]
  .filter(Boolean)
  .join(',');

const allowedOrigins = originSource
  ? originSource.split(',').flatMap(o => {
      const trimmed = o.trim();
      if (!trimmed) return [];
      const variants = [trimmed];
      try {
        const url = new URL(trimmed);
        const host = url.hostname.replace(/^www\./, '');
        variants.push(`${url.protocol}//www.${host}`);
        if (url.protocol === 'https:') variants.push(`http://${host}`, `http://www.${host}`);
      } catch (e) { /* not a URL, keep as-is */ }
      return variants;
    })
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'http://localhost:5175'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    // and allow all localhost origins for development flexibility
    const isLocalDevOrigin =
      Boolean(origin) &&
      process.env.NODE_ENV !== 'production' &&
      (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'));
    if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin) {
      callback(null, true);
    } else {
      console.warn(`[CORS BLOCKED] Origin: ${origin} — allowed: ${allowedOrigins.join(', ')}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
  if (req.url.startsWith('/kinerjaberkah/api')) {
    req.url = req.url.replace('/kinerjaberkah/api', '/api');
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(accessLogger);

app.use('/api', apiLimiter);

app.get('/api/health', async (req, res) => {
  const status = {
    status: 'ok',
    serverTime: new Date().toISOString(),
    uptime: process.uptime(),
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'development'
  };
  try {
    await db.query('SELECT 1');
    status.db = 'connected';
  } catch (e) {
    status.db = 'disconnected';
  }
  res.setHeader('X-App', 'kinerjaberkah');
  res.json(status);
});

app.use(checkLicense);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/pegawai', pegawaiRoutes);
app.use('/api/parameters', parameterRoutes);
app.use('/api/mutations', mutationRoutes);
app.use('/api', lookupRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/2fa', twoFARoutes);
app.use('/api/maker-checker', makerCheckerRoutes);
app.use('/api/pdf', pdfRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan' });
});

app.use(errorLogger);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ message: 'Terjadi kesalahan pada server' });
});

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on 127.0.0.1:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  server.on('error', (err) => {
    console.error('Listen error:', err.message);
    process.exit(1);
  });
}

module.exports = app;
