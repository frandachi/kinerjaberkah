const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { computeKpiYtdScores } = require('../lib/kpi-scoring');
const unitInduk = require('../lib/unit-induk.json');

const router = express.Router();
const THRESHOLD = 100;
const EVIDENCE_MAX_BYTES = 2.5 * 1024 * 1024;
const EVIDENCE_DIR = path.join(__dirname, '..', 'uploads', 'kpi-coaching');
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

let commentsTableReady = false;

function isLeaderJabatan(jabatan = '') {
  const j = String(jabatan || '').toLowerCase();
  if (j.includes('wakil')) return false;
  return (
    j.includes('pemimpin cabang') ||
    j.includes('pemimpin unit') ||
    j.includes('pemimpin divisi') ||
    j.includes('pemimpin departemen') ||
    j.includes('kepala divisi') ||
    j.includes('kepala departemen')
  );
}

function isPrivileged(user) {
  return user?.role === 'admin' || user?.role === 'superadmin';
}

function childUnitsOf(unitName) {
  const parent = String(unitName || '').trim();
  if (!parent) return [];
  const children = [];
  for (const [child, p] of Object.entries(unitInduk || {})) {
    if (String(p || '').trim() === parent) children.push(child);
  }
  return children;
}

async function ensureCommentsTable() {
  if (commentsTableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS kpi_coaching_comments (
      id VARCHAR(50) PRIMARY KEY,
      kpi_id VARCHAR(50) NOT NULL,
      parent_id VARCHAR(50) NULL,
      author_id VARCHAR(100) NOT NULL,
      body TEXT NOT NULL,
      action_plan TEXT NULL,
      evidence_path VARCHAR(255) NULL,
      evidence_original_name VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_kpi_coaching_kpi (kpi_id),
      INDEX idx_kpi_coaching_parent (parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  commentsTableReady = true;
}

async function loadActor(req) {
  const [rows] = await db.query(
    'SELECT id, name, username, role, jabatan, unit_name FROM users WHERE id = ? LIMIT 1',
    [req.user.id]
  );
  return rows[0] || {
    id: req.user.id,
    name: req.user.name || req.user.username || '',
    username: req.user.username,
    role: req.user.role,
    jabatan: req.user.jabatan,
    unit_name: req.user.unit_name,
  };
}

function actorIsLeader(actor) {
  return isPrivileged(actor) || isLeaderJabatan(actor.jabatan);
}

async function loadTeamMembers(actor) {
  if (isPrivileged(actor)) {
    const [rows] = await db.query(
      `SELECT id, name, jabatan, unit_name
       FROM users
       WHERE role != 'superadmin'
         AND jabatan IS NOT NULL AND TRIM(jabatan) != '' AND jabatan != '-'
         AND unit_name IS NOT NULL AND TRIM(unit_name) != ''`
    );
    return rows;
  }

  const byId = new Map();
  const add = (row) => {
    if (!row || String(row.id) === String(actor.id)) return;
    byId.set(String(row.id), row);
  };

  const [direct] = await db.query(
    `SELECT id, name, jabatan, unit_name
     FROM users
     WHERE LOWER(TRIM(supervisi_approval)) = LOWER(TRIM(?))
       AND id != ?`,
    [actor.name || '', actor.id]
  );
  direct.forEach(add);

  const units = new Set([String(actor.unit_name || '').trim()].filter(Boolean));
  childUnitsOf(actor.unit_name).forEach((u) => units.add(u));

  const unitList = [...units].filter(Boolean);
  if (unitList.length) {
    const placeholders = unitList.map(() => '?').join(',');
    const [sameUnits] = await db.query(
      `SELECT id, name, jabatan, unit_name
       FROM users
       WHERE unit_name IN (${placeholders}) AND id != ?`,
      [...unitList, actor.id]
    );
    sameUnits.forEach(add);
  }

  return [...byId.values()];
}

function uniquePairs(members) {
  const seen = new Set();
  const pairs = [];
  for (const m of members) {
    const jabatan = String(m.jabatan || '').trim();
    const unit = String(m.unit_name || '').trim();
    if (!jabatan || !unit) continue;
    const key = `${jabatan.toLowerCase()}||${unit.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ jabatan, unit, member: m });
  }
  return pairs;
}

async function loadKpisForPairs(pairs) {
  if (!pairs.length) return [];
  const clauses = [];
  const params = [];
  for (const p of pairs) {
    clauses.push('(jabatan = ? AND unit_name = ?)');
    params.push(p.jabatan, p.unit);
  }
  const [rows] = await db.query(
    `SELECT id, name, perspective, unit, polarity, target, weight,
            monthly_data, monthly_target, manual_indeks, jabatan, unit_name, unit_type
     FROM kpis
     WHERE COALESCE(unit_type, '') <> 'master'
       AND (${clauses.join(' OR ')})
     ORDER BY unit_name ASC, jabatan ASC, id ASC`,
    params
  );
  return rows;
}

async function commentStatsByKpi(kpiIds) {
  const empty = { leader_comments: 0, member_replies: 0, needs_member_action: false };
  if (!kpiIds.length) return new Map();
  await ensureCommentsTable();
  const placeholders = kpiIds.map(() => '?').join(',');
  const [counts] = await db.query(
    `SELECT kpi_id,
            SUM(parent_id IS NULL) AS leader_comments,
            SUM(parent_id IS NOT NULL) AS member_replies
     FROM kpi_coaching_comments
     WHERE kpi_id IN (${placeholders})
     GROUP BY kpi_id`,
    kpiIds
  );
  const [waiting] = await db.query(
    `SELECT c.kpi_id
     FROM kpi_coaching_comments c
     LEFT JOIN kpi_coaching_comments r ON r.parent_id = c.id
     WHERE c.parent_id IS NULL
       AND r.id IS NULL
       AND c.kpi_id IN (${placeholders})
     GROUP BY c.kpi_id`,
    kpiIds
  );
  const map = new Map();
  for (const row of counts) {
    map.set(String(row.kpi_id), {
      leader_comments: Number(row.leader_comments) || 0,
      member_replies: Number(row.member_replies) || 0,
      needs_member_action: false,
    });
  }
  for (const row of waiting) {
    const cur = map.get(String(row.kpi_id)) || { ...empty };
    cur.needs_member_action = true;
    map.set(String(row.kpi_id), cur);
  }
  return map;
}

function memberLookup(pairs) {
  const map = new Map();
  for (const p of pairs) {
    map.set(`${p.jabatan.toLowerCase()}||${p.unit.toLowerCase()}`, p.member);
  }
  return map;
}

async function buildAlerts(pairs) {
  const kpis = await loadKpisForPairs(pairs);
  const members = memberLookup(pairs);
  const scoredAlerts = [];
  for (const kpi of kpis) {
    const scores = computeKpiYtdScores(kpi);
    if (!scores.scored) continue;
    if (Number(scores.pencapaian) >= THRESHOLD) continue;
    const member = members.get(
      `${String(kpi.jabatan || '').trim().toLowerCase()}||${String(kpi.unit_name || '').trim().toLowerCase()}`
    );
    scoredAlerts.push({
      kpi_id: kpi.id,
      kpi_name: kpi.name,
      perspective: kpi.perspective,
      pencapaian: Number(scores.pencapaian) || 0,
      member_name: member?.name || '',
      member_jabatan: kpi.jabatan || member?.jabatan || '',
      member_unit: kpi.unit_name || member?.unit_name || '',
    });
  }

  const stats = await commentStatsByKpi(scoredAlerts.map((a) => a.kpi_id));
  return scoredAlerts
    .map((a) => {
      const c = stats.get(String(a.kpi_id)) || {
        leader_comments: 0,
        member_replies: 0,
        needs_member_action: false,
      };
      return { ...a, ...c };
    })
    .sort((a, b) => a.pencapaian - b.pencapaian || String(a.kpi_name).localeCompare(String(b.kpi_name), 'id'));
}

function payload(alerts, isLeader) {
  return {
    alerts,
    count: alerts.length,
    threshold: THRESHOLD,
    is_leader: !!isLeader,
  };
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function decodeEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object') return null;
  const raw = String(evidence.base64 || '');
  if (!raw) return null;
  const comma = raw.indexOf(',');
  const b64 = comma >= 0 && raw.slice(0, comma).includes('base64') ? raw.slice(comma + 1) : raw;
  let buf;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch {
    throw Object.assign(new Error('File bukti tidak valid'), { status: 400 });
  }
  if (!buf.length) return null;
  if (buf.length > EVIDENCE_MAX_BYTES) {
    throw Object.assign(new Error('Ukuran bukti maksimal 2.5MB'), { status: 400 });
  }
  const mimeType = String(evidence.mimeType || 'application/octet-stream').toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) {
    throw Object.assign(new Error('Tipe file bukti tidak diizinkan'), { status: 400 });
  }
  const originalName = path.basename(String(evidence.originalName || 'bukti')).replace(/[^\w.\- ()]+/g, '_').slice(0, 120);
  const ext = path.extname(originalName).slice(0, 10);
  const stored = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  return { buf, stored, originalName };
}

function saveEvidence(decoded) {
  if (!decoded) return { evidence_path: null, evidence_original_name: null };
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_DIR, decoded.stored), decoded.buf);
  return { evidence_path: decoded.stored, evidence_original_name: decoded.originalName };
}

async function kpiOwnedByActor(kpiId, actor) {
  const [rows] = await db.query(
    'SELECT id, jabatan, unit_name FROM kpis WHERE id = ? LIMIT 1',
    [kpiId]
  );
  const kpi = rows[0];
  if (!kpi) return null;
  const same =
    String(kpi.jabatan || '') === String(actor.jabatan || '') &&
    String(kpi.unit_name || '') === String(actor.unit_name || '');
  return { kpi, same };
}

router.get('/my-alerts', authenticateToken, async (req, res) => {
  try {
    await ensureCommentsTable();
    const actor = await loadActor(req);
    const pairs = uniquePairs([
      {
        id: actor.id,
        name: actor.name,
        jabatan: actor.jabatan,
        unit_name: actor.unit_name,
      },
    ]);
    const alerts = await buildAlerts(pairs);
    res.setHeader('Cache-Control', 'no-store');
    res.json(payload(alerts, actorIsLeader(actor)));
  } catch (error) {
    console.error('my-alerts error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/team-alerts', authenticateToken, async (req, res) => {
  try {
    await ensureCommentsTable();
    const actor = await loadActor(req);
    const leader = actorIsLeader(actor);
    if (!leader && !isPrivileged(actor)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json(payload([], false));
    }
    const members = await loadTeamMembers(actor);
    const alerts = await buildAlerts(uniquePairs(members));
    res.setHeader('Cache-Control', 'no-store');
    res.json(payload(alerts, true));
  } catch (error) {
    console.error('team-alerts error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/comments/:kpiId', authenticateToken, async (req, res) => {
  try {
    await ensureCommentsTable();
    const kpiId = String(req.params.kpiId || '').trim();
    if (!kpiId) return res.status(400).json({ message: 'KPI tidak valid' });

    const [rows] = await db.query(
      `SELECT c.id, c.kpi_id, c.parent_id, c.body, c.action_plan, c.evidence_path,
              c.evidence_original_name, c.created_at, u.name AS author_name
       FROM kpi_coaching_comments c
       LEFT JOIN users u ON u.id = c.author_id
       WHERE c.kpi_id = ?
       ORDER BY c.created_at ASC`,
      [kpiId]
    );

    const byId = new Map();
    const roots = [];
    for (const row of rows) {
      const item = {
        id: row.id,
        author_name: row.author_name || 'Pengguna',
        created_at: row.created_at,
        body: row.body,
        action_plan: row.action_plan || '',
        evidence_path: row.evidence_path || null,
        evidence_original_name: row.evidence_original_name || null,
        replies: [],
      };
      byId.set(row.id, item);
      if (!row.parent_id) roots.push(item);
    }
    for (const row of rows) {
      if (!row.parent_id) continue;
      const parent = byId.get(row.parent_id);
      const child = byId.get(row.id);
      if (parent && child) parent.replies.push(child);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({ comments: roots });
  } catch (error) {
    console.error('coaching comments error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/comments', authenticateToken, async (req, res) => {
  try {
    await ensureCommentsTable();
    const actor = await loadActor(req);
    if (!actorIsLeader(actor)) {
      return res.status(403).json({ message: 'Hanya atasan yang dapat memberi komentar' });
    }
    const kpiId = String(req.body?.kpi_id || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!kpiId || !body) {
      return res.status(400).json({ message: 'KPI dan komentar wajib diisi' });
    }
    const [kpis] = await db.query('SELECT id FROM kpis WHERE id = ? LIMIT 1', [kpiId]);
    if (!kpis.length) return res.status(404).json({ message: 'KPI tidak ditemukan' });

    const id = newId('kcc');
    await db.query(
      `INSERT INTO kpi_coaching_comments (id, kpi_id, parent_id, author_id, body, created_at)
       VALUES (?, ?, NULL, ?, ?, NOW())`,
      [id, kpiId, actor.id, body]
    );
    res.status(201).json({ id, message: 'Komentar tersimpan' });
  } catch (error) {
    console.error('post coaching comment error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/replies', authenticateToken, async (req, res) => {
  try {
    await ensureCommentsTable();
    const actor = await loadActor(req);
    const kpiId = String(req.body?.kpi_id || '').trim();
    const parentId = String(req.body?.parent_id || '').trim();
    const body = String(req.body?.body || '').trim();
    const actionPlan = String(req.body?.action_plan || '').trim();
    if (!kpiId || !parentId || !body || !actionPlan) {
      return res.status(400).json({ message: 'Balasan, KPI, dan rencana action wajib diisi' });
    }

    const owned = await kpiOwnedByActor(kpiId, actor);
    if (!owned) return res.status(404).json({ message: 'KPI tidak ditemukan' });
    if (!owned.same && !isPrivileged(actor)) {
      return res.status(403).json({ message: 'Anda hanya dapat membalas KPI sendiri' });
    }

    const [parents] = await db.query(
      'SELECT id FROM kpi_coaching_comments WHERE id = ? AND kpi_id = ? AND parent_id IS NULL LIMIT 1',
      [parentId, kpiId]
    );
    if (!parents.length) return res.status(404).json({ message: 'Komentar atasan tidak ditemukan' });

    let decoded = null;
    try {
      decoded = decodeEvidence(req.body?.evidence);
    } catch (e) {
      return res.status(e.status || 400).json({ message: e.message });
    }
    const saved = saveEvidence(decoded);

    const id = newId('kcr');
    await db.query(
      `INSERT INTO kpi_coaching_comments
        (id, kpi_id, parent_id, author_id, body, action_plan, evidence_path, evidence_original_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, kpiId, parentId, actor.id, body, actionPlan, saved.evidence_path, saved.evidence_original_name]
    );
    res.status(201).json({ id, message: 'Balasan tersimpan' });
  } catch (error) {
    console.error('post coaching reply error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/evidence/:filename', authenticateToken, async (req, res) => {
  try {
    await ensureCommentsTable();
    const filename = path.basename(String(req.params.filename || ''));
    if (!filename || filename !== String(req.params.filename || '')) {
      return res.status(400).json({ message: 'Nama file tidak valid' });
    }
    const [rows] = await db.query(
      'SELECT evidence_original_name FROM kpi_coaching_comments WHERE evidence_path = ? LIMIT 1',
      [filename]
    );
    if (!rows.length) return res.status(404).json({ message: 'Bukti tidak ditemukan' });
    const filePath = path.join(EVIDENCE_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Berkas bukti tidak ada' });
    const downloadName = rows[0].evidence_original_name || filename;
    res.setHeader('Cache-Control', 'no-store');
    res.download(filePath, downloadName);
  } catch (error) {
    console.error('download evidence error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
