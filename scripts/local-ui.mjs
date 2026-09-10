#!/usr/bin/env node
/** Local static UI + API proxy for built zip (no Vite src). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.UI_PORT || 8080);
const API = process.env.API_ORIGIN || 'http://127.0.0.1:3001';

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

function proxyApi(req, res) {
  const target = new URL(req.url.replace(/^\/kinerjaberkah\/api/, '/api'), API);
  const headers = { ...req.headers, host: target.host };
  const upstream = http.request(
    target,
    { method: req.method, headers },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    }
  );
  upstream.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'API unreachable', error: err.message }));
  });
  req.pipe(upstream);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url.startsWith('/kinerjaberkah/api')) {
    return proxyApi(req, res);
  }

  let rel = url;
  if (rel === '/' || rel === '/kinerjaberkah' || rel === '/kinerjaberkah/') {
    rel = '/kinerjaberkah/index.html';
  }
  if (!rel.startsWith('/kinerjaberkah/')) {
    res.writeHead(302, { Location: '/kinerjaberkah/' });
    return res.end();
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
});
