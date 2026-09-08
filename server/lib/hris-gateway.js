const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');

function getConfig() {
  return {
    baseUrl: (process.env.HRIS_BASE_URL || '').replace(/\/$/, ''),
    apiKey: process.env.HRIS_API_KEY || '',
    clientId: process.env.HRIS_CLIENT_ID || '',
    clientKey: process.env.HRIS_CLIENT_KEY || '',
    clientIp: (process.env.HRIS_CLIENT_IP || '').trim(),
    timeoutMs: Number(process.env.HRIS_TIMEOUT_MS || 10000),
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Mirror PHP: date('Y-m-d H:i:s') . '.' . substr((string)microtime(true), 2, 6) */
function buildTimestamp(date = new Date()) {
  const datePart =
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
  const mtStr = String(Date.now() / 1000);
  return `${datePart}.${mtStr.substring(2, 8)}`;
}

function getClientSecret(timestamp, cfg = getConfig()) {
  let plain = `${cfg.clientId}&${cfg.apiKey}`;
  if (cfg.clientIp) {
    plain += `&${cfg.clientIp}`;
  }
  plain += `&${timestamp}`;
  return crypto.createHmac('sha256', cfg.clientKey).update(plain, 'utf8').digest('base64');
}

function encodeCredential(plain) {
  return Buffer.from(String(plain ?? ''), 'utf8').toString('base64');
}

function postJson(path, body) {
  const cfg = getConfig();
  if (!cfg.baseUrl) {
    return Promise.reject(new Error('HRIS_BASE_URL belum dikonfigurasi'));
  }

  const timestamp = buildTimestamp();
  const clientSecret = getClientSecret(timestamp, cfg);
  const url = new URL(path.startsWith('http') ? path : `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
  const payload = JSON.stringify(body ?? {});
  const client = url.protocol === 'https:' ? https : http;

  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'X-Api-Key': cfg.apiKey,
    'X-Client-Id': cfg.clientId,
    'X-Timestamp': timestamp,
    'X-Client-Secret': clientSecret,
    'X-Signature': '',
  };

  return new Promise((resolve, reject) => {
    const req = client.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers,
        rejectUnauthorized: false,
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          if (!raw || !String(raw).trim()) {
            return reject(new Error(`Gateway empty response (HTTP ${res.statusCode})`));
          }
          let decoded;
          try {
            decoded = JSON.parse(raw);
          } catch (e) {
            return reject(new Error(`Gateway invalid JSON (HTTP ${res.statusCode}): ${e.message}`));
          }
          resolve({ httpCode: res.statusCode, body: decoded });
        });
      }
    );

    req.on('error', (err) => reject(new Error(`Gateway connection error: ${err.message}`)));
    req.setTimeout(cfg.timeoutMs, () => {
      req.destroy(new Error(`Gateway timeout after ${cfg.timeoutMs}ms`));
    });
    req.write(payload);
    req.end();
  });
}

function assertOk(decoded, label) {
  const rcode = decoded?.rcode != null ? String(decoded.rcode) : '';
  if (rcode !== '00') {
    const message = decoded?.message || decoded?.msg || `HRIS ${label} gagal`;
    const err = new Error(message);
    err.rcode = rcode || '99';
    err.hris = decoded;
    throw err;
  }
  return decoded;
}

async function authLogin({ username, password }) {
  const { body } = await postJson('/hris/authLogin', {
    reqid: 'HR001',
    userId: encodeCredential(username),
    password: encodeCredential(password),
  });
  const decoded = assertOk(body, 'authLogin');
  const data = Array.isArray(decoded.data) ? decoded.data : decoded.data ? [decoded.data] : [];
  if (data.length === 0 && decoded.result) {
    return Array.isArray(decoded.result) ? decoded.result : [decoded.result];
  }
  return data;
}

async function inqMasterPegawaiByKondisi(kondisi = '') {
  const { body } = await postJson('/hris/inqMasterPegawaiByKondisi', {
    reqid: 'HR006',
    kondisi: kondisi == null ? '' : String(kondisi),
  });
  const decoded = assertOk(body, 'inqMasterPegawaiByKondisi');
  if (Array.isArray(decoded.data)) return decoded.data;
  if (Array.isArray(decoded.result)) return decoded.result;
  if (decoded.data) return [decoded.data];
  return [];
}

module.exports = {
  buildTimestamp,
  getClientSecret,
  encodeCredential,
  postJson,
  authLogin,
  inqMasterPegawaiByKondisi,
};
