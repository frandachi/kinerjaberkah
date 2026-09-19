#!/usr/bin/env node
/** Local static UI + API proxy for built zip (no Vite src).
 *  Default: proxy API ke server production (bukan DB lokal).
 *  Override lokal: API_ORIGIN=http://127.0.0.1:3001 UI_PORT=8080 node scripts/local-ui.mjs
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.UI_PORT || 8080);
/** Production by default so form saves hit server DB, not local MySQL. */
const API = (process.env.API_ORIGIN || 'https://pasiongov.com').replace(/\/$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function resolveApiUrl(reqUrl) {
  const u = new URL(reqUrl, 'http://local.invalid');
  const bareLocal =
    /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(API) ||
    /:3001$/i.test(API);
  // Local Node listens on /api; production Apache on /kinerjaberkah/api
  const pathname = bareLocal
    ? u.pathname.replace(/^\/kinerjaberkah\/api/, '/api')
    : u.pathname;
  return new URL(pathname + u.search, API + '/');
}

function proxyApi(req, res) {
  const target = resolveApiUrl(req.url);
  const lib = target.protocol === 'https:' ? https : http;
  const headers = { ...req.headers, host: target.host };
  delete headers['accept-encoding'];

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    });
    return res.end();
  }

  const upstream = lib.request(target, { method: req.method, headers }, (up) => {
    const outHeaders = { ...up.headers };
    delete outHeaders['access-control-allow-origin'];
    delete outHeaders['access-control-allow-credentials'];
    res.writeHead(up.statusCode || 502, {
      ...outHeaders,
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
    });
    up.pipe(res);
  });
  upstream.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'API unreachable', error: err.message, target: target.href }));
  });
  req.pipe(upstream);
}

const ASSET_STORE = fs.existsSync(path.join(ROOT, 'asset-files'))
  ? path.join(ROOT, 'asset-files')
  : path.join(ROOT, 'assets');

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
  });
  fs.createReadStream(filePath).pipe(res);
}

function sendAssetByName(res, name) {
  const safe = String(name || '').replace(/\0/g, '').replace(/\\/g, '').replace(/\.\./g, '');
  if (!safe) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Bad request');
  }
  const filePath = path.join(ASSET_STORE, safe);
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    return sendFile(res, filePath);
  });
}

const server = http.createServer((req, res) => {
  const rawUrl = req.url || '/';
  const u = new URL(rawUrl, 'http://127.0.0.1');
  const url = u.pathname;

  if (url.startsWith('/kinerjaberkah/api')) {
    return proxyApi(req, res);
  }

  // Mirror prod PHP asset proxy
  if (url === '/kinerjaberkah/assets/nocache.php') {
    return sendAssetByName(res, u.searchParams.get('f') || '');
  }

  let rel = url;
  if (rel === '/' || rel === '/kinerjaberkah' || rel === '/kinerjaberkah/') {
    rel = '/kinerjaberkah/index.html';
  }
  if (!rel.startsWith('/kinerjaberkah/')) {
    res.writeHead(302, { Location: '/kinerjaberkah/' });
    return res.end();
  }

  // /kinerjaberkah/assets/foo.js -> asset-files/foo.js (or assets/)
  if (rel.startsWith('/kinerjaberkah/assets/') && !rel.endsWith('/')) {
    const name = rel.slice('/kinerjaberkah/assets/'.length);
    if (name && name !== 'nocache.php') {
      return sendAssetByName(res, name);
    }
  }

  const filePath = path.join(ROOT, rel.replace(/^\/kinerjaberkah\/?/, ''));
  fs.stat(filePath, (err, st) => {
    if (!err && st.isFile()) return sendFile(res, filePath);
    return sendFile(res, path.join(ROOT, 'index.html'));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`UI  http://127.0.0.1:${PORT}/kinerjaberkah/`);
  console.log(`API proxy → ${API}`);
  if (/127\.0\.0\.1|localhost/i.test(API)) {
    console.warn('⚠ API_ORIGIN lokal — data masuk MySQL lokal, bukan DB server.');
  } else {
    console.log('✓ Input form akan tersimpan ke DB server production.');
  }
});
