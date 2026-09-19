require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

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
const kpiCoachingRoutes = require('./routes/kpi-coaching');
const kpiEvidenceRoutes = require('./routes/kpi-evidence');
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

// Gzip JSON/API responses (full KPI list can be multi-MB without compression)
app.use(compression({ threshold: 1024 }));

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
      origin &&
      process.env.NODE_ENV !== 'production' &&
      (String(origin).startsWith('http://localhost:') || String(origin).startsWith('http://127.0.0.1:'));
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
  let url = req.url || '';
  // Full public path (Apache may pass the original URI)
  if (url.startsWith('/kinerjaberkah/api')) {
    url = url.replace('/kinerjaberkah/api', '/api');
  }
  // PassengerBaseURI=/kinerjaberkah/api strips the base; remaining path is e.g. /auth/captcha
  if (!url.startsWith('/api')) {
    const pathOnly = url.split('?')[0];
    if (
      pathOnly === '/health' ||
      pathOnly.startsWith('/auth') ||
      pathOnly.startsWith('/users') ||
      pathOnly.startsWith('/kpis') ||
      pathOnly.startsWith('/pegawai') ||
      pathOnly.startsWith('/parameters') ||
      pathOnly.startsWith('/mutations') ||
      pathOnly.startsWith('/system') ||
      pathOnly.startsWith('/2fa') ||
      pathOnly.startsWith('/maker-checker') ||
      pathOnly.startsWith('/pdf') ||
      pathOnly.startsWith('/kpi-coaching') ||
      pathOnly.startsWith('/kpi-evidence') ||
      pathOnly.startsWith('/satuans') ||
      pathOnly.startsWith('/targets') ||
      pathOnly.startsWith('/objectives') ||
      pathOnly.startsWith('/strategies') ||
      pathOnly.startsWith('/perspectives') ||
      pathOnly.startsWith('/units') ||
      pathOnly.startsWith('/__assets') ||
      pathOnly.startsWith('/jabatans') ||
      pathOnly.startsWith('/leaders')
    ) {
      url = '/api' + url;
    }
  }
  req.url = url;
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(accessLogger);

// Serve UI assets via Node so DomaiNesia cannot force max-age=2592000 on raw .js/.css
// Optional asset path via Node (prefer PHP /assets/nocache.php?f= on DomaiNesia —
// hosting overwrites Cache-Control for URL paths ending in .js).
const ASSETS_ROOT = [
  path.resolve(__dirname, '..', 'asset-files'),
  path.resolve(__dirname, '..', 'assets')
].find((p) => {
  try { return fs.existsSync(p); } catch (_) { return false; }
}) || path.resolve(__dirname, '..', 'assets');
const sendAssetNoCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-KB-Cache', 'off');
  next();
};
const assetStatic = express.static(ASSETS_ROOT, {
  etag: false,
  lastModified: false,
  maxAge: 0,
  index: false,
  fallthrough: false
});
app.use('/api/__assets', sendAssetNoCache, assetStatic);
app.use('/__assets', sendAssetNoCache, assetStatic);

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
app.use('/api/kpi-coaching', kpiCoachingRoutes);
app.use('/api/kpi-evidence', kpiEvidenceRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan' });
});

app.use(errorLogger);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ message: 'Terjadi kesalahan pada server' });
});

const PORT = process.env.PORT || 3001;

// Phusion Passenger (cPanel Node Selector): must listen on 'passenger', not TCP PORT.
// Binding PORT while PM2 also uses it causes Passenger 500/timeouts after restart.
if (typeof PhusionPassenger !== 'undefined') {
  PhusionPassenger.configure({ autoInstall: false });
  app.listen('passenger');
} else if (require.main === module) {
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
