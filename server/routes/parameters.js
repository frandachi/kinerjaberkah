const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorize');
const { auditMiddleware } = require('../middleware/audit');
const { normalizeUnit } = require('../lib/kpi-scoring');

const router = express.Router();

// Master data rarely changes within a session — short private cache
router.use((req, res, next) => {
  if (req.method === 'GET') res.setHeader('Cache-Control', 'private, max-age=60');
  next();
});


const createCrudRoutes = (tableName, { readRoles = ['superadmin', 'admin'] } = {}) => {
  router.get(`/${tableName}`, authenticateToken, authorizeRole(...readRoles), async (req, res) => {
    try {
      const [rows] = await db.query(`SELECT * FROM ${tableName} ORDER BY created_at ASC`);
      res.json(rows);
    } catch (error) {
      console.error(`Get ${tableName} error:`, error.message);
      res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
  });

  router.post(`/${tableName}`, authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
    try {
      const { name } = req.body;
      const prefix = tableName === 'satuans' ? 'sat_' : 'tar_';
      const id = prefix + Date.now();
      await db.query(`INSERT INTO ${tableName} (id, name) VALUES (?, ?)`, [id, name]);
      res.status(201).json({ id, name });
    } catch (error) {
      console.error(`Create ${tableName} error:`, error.message);
      res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
  });

  router.put(`/${tableName}/:id`, authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
    try {
      const { name } = req.body;
      await db.query(`UPDATE ${tableName} SET name = ? WHERE id = ?`, [name, req.params.id]);
      res.json({ id: req.params.id, name });
    } catch (error) {
      console.error(`Update ${tableName} error:`, error.message);
      res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
  });

  router.delete(`/${tableName}/:id`, authenticateToken, authorizeRole('superadmin'), async (req, res) => {
    try {
      await db.query(`DELETE FROM ${tableName} WHERE id = ?`, [req.params.id]);
      res.json({ message: 'Deleted successfully' });
    } catch (error) {
      console.error(`Delete ${tableName} error:`, error.message);
      res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
  });
};

// Satuan = label tampilan; `tipe` menentukan cara hitung (sama dengan kpis.unit).
const SATUAN_TIPE = ['percentage', 'currency', 'score', 'number'];
let satuanColsReady = null;
function ensureSatuanCols() {
  if (!satuanColsReady) {
    satuanColsReady = (async () => {
      const [cols] = await db.query('SHOW COLUMNS FROM satuans');
      const have = new Set(cols.map((c) => c.Field));
      if (!have.has('tipe')) await db.query('ALTER TABLE satuans ADD COLUMN tipe VARCHAR(20) NULL');
      if (!have.has('keterangan')) await db.query('ALTER TABLE satuans ADD COLUMN keterangan VARCHAR(255) NULL');
    })().catch((err) => {
      satuanColsReady = null;
      throw err;
    });
  }
  return satuanColsReady;
}

function readSatuanBody(body) {
  const name = String(body?.name || '').trim().replace(/\s+/g, ' ');
  const tipe = String(body?.tipe || '').trim();
  const keterangan = String(body?.keterangan || '').trim().slice(0, 255);
  if (!name) return { error: 'Nama satuan wajib diisi' };
  if (name.length > 100) return { error: 'Nama satuan maksimal 100 karakter' };
  if (!SATUAN_TIPE.includes(tipe)) return { error: 'Tipe perhitungan tidak valid' };
  return { name, tipe, keterangan };
}

async function satuanUsage() {
  const [rows] = await db.query(
    "SELECT CASE WHEN unit_type = 'master' THEN 'master' ELSE 'kpi' END AS src, unit, COUNT(*) AS n FROM kpis GROUP BY src, unit"
  );
  const usage = { kpi: {}, master: {}, nonstandard: [] };
  for (const t of SATUAN_TIPE) { usage.kpi[t] = 0; usage.master[t] = 0; }
  for (const r of rows) {
    const tipe = normalizeUnit(r.unit);
    usage[r.src][tipe] += Number(r.n) || 0;
    if (!SATUAN_TIPE.includes(r.unit)) usage.nonstandard.push({ unit: r.unit, tipe, src: r.src, n: Number(r.n) || 0 });
  }
  return usage;
}

router.get('/satuans', authenticateToken, authorizeRole('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    await ensureSatuanCols();
    const [rows] = await db.query('SELECT * FROM satuans ORDER BY created_at ASC');
    res.setHeader('Cache-Control', 'no-store');
    res.json(rows);
  } catch (error) {
    console.error('Get satuans error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/satuans/usage', authenticateToken, authorizeRole('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await satuanUsage());
  } catch (error) {
    console.error('Satuan usage error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/satuans', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('CREATE_SATUAN'), async (req, res) => {
  try {
    await ensureSatuanCols();
    const data = readSatuanBody(req.body);
    if (data.error) return res.status(400).json({ message: data.error });
    const [dup] = await db.query('SELECT id FROM satuans WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1', [data.name]);
    if (dup.length) return res.status(409).json({ message: `Satuan "${data.name}" sudah ada` });
    const id = 'sat_' + Date.now();
    await db.query('INSERT INTO satuans (id, name, tipe, keterangan) VALUES (?, ?, ?, ?)', [id, data.name, data.tipe, data.keterangan || null]);
    res.status(201).json({ id, ...data });
  } catch (error) {
    console.error('Create satuan error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.put('/satuans/:id', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('UPDATE_SATUAN'), async (req, res) => {
  try {
    await ensureSatuanCols();
    const data = readSatuanBody(req.body);
    if (data.error) return res.status(400).json({ message: data.error });
    const [cur] = await db.query('SELECT id FROM satuans WHERE id = ? LIMIT 1', [req.params.id]);
    if (!cur.length) return res.status(404).json({ message: 'Satuan tidak ditemukan' });
    const [dup] = await db.query('SELECT id FROM satuans WHERE LOWER(TRIM(name)) = LOWER(?) AND id <> ? LIMIT 1', [data.name, req.params.id]);
    if (dup.length) return res.status(409).json({ message: `Satuan "${data.name}" sudah ada` });
    await db.query('UPDATE satuans SET name = ?, tipe = ?, keterangan = ? WHERE id = ?', [data.name, data.tipe, data.keterangan || null, req.params.id]);
    res.json({ id: req.params.id, ...data });
  } catch (error) {
    console.error('Update satuan error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.delete('/satuans/:id', authenticateToken, authorizeRole('superadmin'), auditMiddleware('DELETE_SATUAN'), async (req, res) => {
  try {
    await ensureSatuanCols();
    const [cur] = await db.query('SELECT id, name, tipe FROM satuans WHERE id = ? LIMIT 1', [req.params.id]);
    if (!cur.length) return res.status(404).json({ message: 'Satuan tidak ditemukan' });
    const tipe = cur[0].tipe || normalizeUnit(cur[0].name);
    const [same] = await db.query('SELECT id, name, tipe FROM satuans WHERE id <> ?', [req.params.id]);
    const othersOfTipe = same.filter((s) => (s.tipe || normalizeUnit(s.name)) === tipe).length;
    const usage = await satuanUsage();
    const used = usage.kpi[tipe] + usage.master[tipe];
    if (!othersOfTipe && used > 0) {
      return res.status(409).json({
        message: `Satuan "${cur[0].name}" adalah satu-satunya satuan bertipe ${tipe} dan dipakai ${used} KPI. Tambahkan satuan lain bertipe sama sebelum menghapus.`,
      });
    }
    await db.query('DELETE FROM satuans WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Delete satuan error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// Samakan kpis.unit lama ("%", "Rp", dll.) ke kode tipe standar.
router.post('/satuans/sync', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('SYNC_SATUAN_KPI'), async (req, res) => {
  try {
    const usage = await satuanUsage();
    let updated = 0;
    const seen = new Set();
    for (const r of usage.nonstandard) {
      if (seen.has(r.unit)) continue;
      seen.add(r.unit);
      const [result] = r.unit == null
        ? await db.query('UPDATE kpis SET unit = ? WHERE unit IS NULL', [r.tipe])
        : await db.query('UPDATE kpis SET unit = ? WHERE unit = ? COLLATE utf8mb4_bin', [r.tipe, r.unit]);
      updated += result.affectedRows;
    }
    res.json({ message: `${updated} KPI disinkronkan`, updated, usage: await satuanUsage() });
  } catch (error) {
    console.error('Sync satuan error:', error.message);
    res.status(500).json({ message: 'Gagal sinkronisasi: ' + error.message });
  }
});

createCrudRoutes('targets', { readRoles: ['superadmin', 'admin', 'user'] });

// objectives has its own shape (perspective/description/divisi), so it gets
// dedicated handlers instead of the generic name-only createCrudRoutes helper.
router.get('/objectives', authenticateToken, authorizeRole('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM objectives ORDER BY created_at ASC');
    res.json(rows);
  } catch (error) {
    console.error('Get objectives error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/objectives', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { name, perspective, description, divisi } = req.body;
    const id = 'obj_' + Date.now();
    await db.query(
      'INSERT INTO objectives (id, name, perspective, description, divisi) VALUES (?, ?, ?, ?, ?)',
      [id, name, perspective || '', description || '', divisi || '']
    );
    res.status(201).json({ id, name, perspective, description, divisi });
  } catch (error) {
    console.error('Create objective error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.put('/objectives/:id', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { name, perspective, description, divisi } = req.body;
    await db.query(
      'UPDATE objectives SET name = ?, perspective = ?, description = ?, divisi = ? WHERE id = ?',
      [name, perspective || '', description || '', divisi || '', req.params.id]
    );
    res.json({ id: req.params.id, name, perspective, description, divisi });
  } catch (error) {
    console.error('Update objective error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.delete('/objectives/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    await db.query('DELETE FROM objectives WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Delete objective error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/strategies', authenticateToken, authorizeRole('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.*, o.name as objective_name, o.divisi as objective_divisi
      FROM strategies s
      LEFT JOIN objectives o ON s.objective_id = o.id
      ORDER BY s.id ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Get strategies error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/strategies', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { objective_id, name, perspective, unit, description, formula } = req.body;
    const id = 'str_' + Date.now();
    await db.query(
      'INSERT INTO strategies (id, objective_id, name, perspective, unit, description, formula) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, objective_id, name, perspective, unit || '%', description || '', formula || '']
    );
    res.status(201).json({ id, objective_id, name, perspective, unit, description, formula });
  } catch (error) {
    console.error('Create strategy error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.put('/strategies/:id', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { objective_id, name, perspective, unit, description, formula } = req.body;
    await db.query(
      'UPDATE strategies SET objective_id = ?, name = ?, perspective = ?, unit = ?, description = ?, formula = ? WHERE id = ?',
      [objective_id, name, perspective, unit || '%', description || '', formula || '', req.params.id]
    );
    res.json({ id: req.params.id, objective_id, name, perspective, unit, description, formula });
  } catch (error) {
    console.error('Update strategy error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.delete('/strategies/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    await db.query('DELETE FROM strategies WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Delete strategy error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

const { setPolaritasMeta } = require('../lib/kpi-polarity');
const POLARITAS_SEED = [
  ['pol_maximize_a', 'maximize_a', 'Maximize A', 'maximize', 'A', 'Laba, pertumbuhan kredit, Col 1 kredit cair < 1 tahun. Target KPI O/S coll 1 < 1 thn target 90%.', 1, 60, 100, 105, 110],
  ['pol_maximize_b', 'maximize_b', 'Maximize B', 'maximize', 'B', 'Kinerja Supporting, tindaklanjut temuan.', 2, 80, 100, 110, 120],
  ['pol_maximize_c', 'maximize_c', 'Maximize C', 'maximize', 'C', 'KPI Indeks kepuasan pelanggan dll. Target 3.', 3, 60, 100, 120, 140],
  ['pol_minimize_a', 'minimize_a', 'Minimize A', 'minimize', 'A', 'Cost of fund, Biaya ATK BBC, air, listrik, BBM, konsumsi dan pertemuan rapat.', 4, 60, 100, 110, 120],
  ['pol_minimize_b', 'minimize_b', 'Minimize B', 'minimize', 'B', 'KPI Peringkat TKS, GCG dll. Target 2.', 5, 40, 60, 80, 100],
  ['pol_minimize_c', 'minimize_c', 'Minimize C', 'stabilize', 'C', 'KPI Rasio NPL Gross.', 6, 0.25, 1, 2, 3],
  ['pol_minimize_d', 'minimize_d', 'Minimize D', 'stabilize', 'C', 'Khusus KPI Denda / Kerugian Regulator (Target 0) — Aktual dikurangi Target. Skor 4 = 0, skor 3 ≤ 10, skor 2 ≤ 50.', 8, 10, 50, 999, 999],
  ['pol_faster', 'faster', 'Faster is better', 'faster', 'B', 'KPI Tindaklanjut temuan (kedepan), SLA. Berlaku untuk tahun 2027.', 7, 80, 100, 110, 120],
];
const POL_BATAS_DEFAULT = { A: [60, 100, 105, 110], B: [80, 100, 110, 120], C: [60, 100, 120, 140] };
const POL_RUMUS = ['maximize', 'minimize', 'faster', 'range', 'stabilize'];
const POL_SKALA = ['A', 'B', 'C'];

let polaritasReady = null;
function ensurePolaritas() {
  if (!polaritasReady) {
    polaritasReady = (async () => {
      await db.query(`CREATE TABLE IF NOT EXISTS polaritas (
        id VARCHAR(40) PRIMARY KEY,
        kode VARCHAR(40) NOT NULL,
        nama VARCHAR(100) NOT NULL,
        rumus VARCHAR(20) NOT NULL,
        skala CHAR(1) NOT NULL,
        keterangan VARCHAR(255) NULL,
        urutan INT NOT NULL DEFAULT 0,
        batas2 DECIMAL(8,2) NULL,
        batas3 DECIMAL(8,2) NULL,
        batas4 DECIMAL(8,2) NULL,
        batas5 DECIMAL(8,2) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_polaritas_kode (kode)
      )`);
      const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM polaritas');
      for (const col of ['batas2', 'batas3', 'batas4', 'batas5']) {
        try {
          await db.query(`ALTER TABLE polaritas ADD COLUMN ${col} DECIMAL(8,2) NULL`);
        } catch (err) {
          if (!/Duplicate column/i.test(err.message)) throw err;
        }
      }
      if (!Number(n)) {
        await db.query(
          'INSERT INTO polaritas (id, kode, nama, rumus, skala, keterangan, urutan, batas2, batas3, batas4, batas5) VALUES ?',
          [POLARITAS_SEED]
        );
      }
      for (const [skala, batas] of Object.entries(POL_BATAS_DEFAULT)) {
        await db.query(
          `UPDATE polaritas SET batas2 = ?, batas3 = ?, batas4 = ?, batas5 = ? WHERE skala = ? AND batas2 IS NULL`,
          [...batas, skala]
        );
      }
      await db.query("UPDATE polaritas SET batas2 = 0.25, batas3 = 1, batas4 = 2, batas5 = 3 WHERE rumus = 'stabilize' AND batas2 >= 10 AND kode <> 'minimize_d'");
      const [haveStab] = await db.query("SELECT id FROM polaritas WHERE kode IN ('minimize_c', 'stabilize')");
      if (!haveStab.length) {
        await db.query(
          `INSERT INTO polaritas (id, kode, nama, rumus, skala, keterangan, urutan, batas2, batas3, batas4, batas5)
           VALUES ('pol_minimize_c', 'minimize_c', 'Minimize C', 'stabilize', 'C', ?, 6, 0.25, 1, 2, 3)`,
          ['KPI Rasio NPL Gross.']
        );
      }
      const [haveMinD] = await db.query("SELECT id FROM polaritas WHERE kode = 'minimize_d'");
      if (!haveMinD.length) {
        await db.query(
          `INSERT INTO polaritas (id, kode, nama, rumus, skala, keterangan, urutan, batas2, batas3, batas4, batas5)
           VALUES ('pol_minimize_d', 'minimize_d', 'Minimize D', 'stabilize', 'C', ?, 8, 10, 50, 999, 999)`,
          ['Khusus KPI Denda / Kerugian Regulator (Target 0) — Aktual dikurangi Target. Skor 4 = 0, skor 3 ≤ 10, skor 2 ≤ 50.']
        );
      }
      const [rows] = await db.query('SELECT kode, rumus, skala, batas2, batas3, batas4, batas5 FROM polaritas');
      setPolaritasMeta(rows);
    })().catch((err) => {
      polaritasReady = null;
      throw err;
    });
  }
  return polaritasReady;
}

function readPolaritasBody(body, { kodeRequired }) {
  const nama = String(body.nama || body.name || '').trim();
  const kode = String(body.kode || '').trim().toLowerCase();
  const rumus = String(body.rumus || '').trim().toLowerCase();
  const skala = String(body.skala || '').trim().toUpperCase();
  const keterangan = String(body.keterangan || '').trim().slice(0, 255);
  const urutan = Number.parseInt(body.urutan, 10);
  const fallback = POL_BATAS_DEFAULT[skala] || POL_BATAS_DEFAULT.A;
  const batas = [body.batas2, body.batas3, body.batas4, body.batas5].map((v, i) => {
    const n = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : fallback[i];
  });
  if (rumus === 'stabilize') {
    const mid = batas[0] > 0 && batas[0] < batas[1] && batas[0] < 20 ? batas[0] : 0.25;
    const high = batas[0] > 0 && batas[0] < batas[1] && batas[0] < 20 ? batas[1] : 1;
    if (!(mid > 0 && mid < high)) {
      const err = new Error('Batas selisih Stabilize harus naik, contoh 0,25 lalu 1');
      err.status = 400;
      throw err;
    }
    batas[0] = mid;
    batas[1] = high;
    batas[2] = high + 1;
    batas[3] = high + 2;
  } else if (!(batas[0] < batas[1] && batas[1] < batas[2] && batas[2] < batas[3])) {
    const err = new Error('Batas skala harus naik: skor 2 < skor 3 < skor 4 < skor 5');
    err.status = 400;
    throw err;
  }
  if (!nama || nama.length > 100) {
    const err = new Error('Nama polaritas wajib diisi, maksimal 100 karakter');
    err.status = 400;
    throw err;
  }
  if (kodeRequired && !/^[a-z][a-z0-9_]{0,39}$/.test(kode)) {
    const err = new Error('Kode wajib huruf kecil, angka, atau garis bawah, dan diawali huruf');
    err.status = 400;
    throw err;
  }
  if (!POL_RUMUS.includes(rumus)) {
    const err = new Error('Rumus harus maximize, minimize, faster, range, atau stabilize');
    err.status = 400;
    throw err;
  }
  if (!POL_SKALA.includes(skala)) {
    const err = new Error('Skala harus A, B, atau C');
    err.status = 400;
    throw err;
  }
  return { nama, kode, rumus, skala, keterangan, urutan: Number.isFinite(urutan) ? urutan : 0, batas2: batas[0], batas3: batas[1], batas4: batas[2], batas5: batas[3] };
}

router.get('/polaritas', authenticateToken, authorizeRole('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    await ensurePolaritas();
    const [rows] = await db.query('SELECT * FROM polaritas ORDER BY urutan ASC, nama ASC');
    res.setHeader('Cache-Control', 'no-store');
    res.json(rows);
  } catch (error) {
    console.error('Get polaritas error:', error.message);
    res.status(500).json({ message: 'Gagal memuat polaritas' });
  }
});

router.post('/polaritas', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('CREATE_POLARITAS'), async (req, res) => {
  try {
    await ensurePolaritas();
    const row = readPolaritasBody(req.body || {}, { kodeRequired: true });
    const [dup] = await db.query('SELECT id FROM polaritas WHERE kode = ?', [row.kode]);
    if (dup.length) return res.status(409).json({ message: `Kode "${row.kode}" sudah ada` });
    const id = `pol_${Date.now()}`;
    await db.query(
      'INSERT INTO polaritas (id, kode, nama, rumus, skala, keterangan, urutan, batas2, batas3, batas4, batas5) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, row.kode, row.nama, row.rumus, row.skala, row.keterangan || null, row.urutan, row.batas2, row.batas3, row.batas4, row.batas5]
    );
    setPolaritasMeta((await db.query('SELECT kode, rumus, skala, batas2, batas3, batas4, batas5 FROM polaritas'))[0]);
    res.status(201).json({ id, ...row });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error('Create polaritas error:', error.message);
    res.status(500).json({ message: 'Gagal menambah polaritas' });
  }
});

router.put('/polaritas/:id', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('UPDATE_POLARITAS'), async (req, res) => {
  try {
    await ensurePolaritas();
    const row = readPolaritasBody(req.body || {}, { kodeRequired: false });
    const [cur] = await db.query('SELECT * FROM polaritas WHERE id = ?', [req.params.id]);
    if (!cur.length) return res.status(404).json({ message: 'Polaritas tidak ditemukan' });
    await db.query(
      'UPDATE polaritas SET nama = ?, rumus = ?, skala = ?, keterangan = ?, urutan = ?, batas2 = ?, batas3 = ?, batas4 = ?, batas5 = ? WHERE id = ?',
      [row.nama, row.rumus, row.skala, row.keterangan || null, row.urutan, row.batas2, row.batas3, row.batas4, row.batas5, req.params.id]
    );
    setPolaritasMeta((await db.query('SELECT kode, rumus, skala, batas2, batas3, batas4, batas5 FROM polaritas'))[0]);
    res.json({ ...cur[0], nama: row.nama, rumus: row.rumus, skala: row.skala, keterangan: row.keterangan, urutan: row.urutan });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error('Update polaritas error:', error.message);
    res.status(500).json({ message: 'Gagal mengubah polaritas' });
  }
});

router.delete('/polaritas/:id', authenticateToken, authorizeRole('superadmin'), auditMiddleware('DELETE_POLARITAS'), async (req, res) => {
  try {
    await ensurePolaritas();
    const [cur] = await db.query('SELECT * FROM polaritas WHERE id = ?', [req.params.id]);
    if (!cur.length) return res.status(404).json({ message: 'Polaritas tidak ditemukan' });
    const [[{ n }]] = await db.query(
      "SELECT COUNT(*) AS n FROM kpis WHERE LOWER(TRIM(polarity)) = ? AND COALESCE(unit_type,'') <> 'master'",
      [cur[0].kode]
    );
    if (Number(n) > 0) {
      return res.status(409).json({ message: `Polaritas dipakai ${n} KPI. Ubah KPI tersebut lebih dulu.` });
    }
    await db.query('DELETE FROM polaritas WHERE id = ?', [req.params.id]);
    setPolaritasMeta((await db.query('SELECT kode, rumus, skala, batas2, batas3, batas4, batas5 FROM polaritas'))[0]);
    res.json({ message: 'Polaritas dihapus' });
  } catch (error) {
    console.error('Delete polaritas error:', error.message);
    res.status(500).json({ message: 'Gagal menghapus polaritas' });
  }
});

const { setPenilaianAkhir } = require('../lib/kpi-scoring');
const NILAI_SEED = [
  ['na_istimewa', 'Istimewa', 'Hijau Tua', 4.51, 5, 1],
  ['na_sangat_baik', 'Sangat Baik', 'Hijau', 3.76, 4.5, 2],
  ['na_baik', 'Baik', 'Hijau Muda', 2.51, 3.75, 3],
  ['na_cukup', 'Cukup Baik', 'Orange', 1.51, 2.5, 4],
  ['na_kurang', 'Kurang', 'Merah', 0, 1.5, 5],
];
const NILAI_WARNA = ['Merah', 'Orange', 'Hijau Muda', 'Hijau', 'Hijau Tua', 'Biru'];
let nilaiReady = null;
function ensurePenilaianAkhir() {
  if (!nilaiReady) {
    nilaiReady = (async () => {
      await db.query(`CREATE TABLE IF NOT EXISTS penilaian_akhir (
        id VARCHAR(40) PRIMARY KEY,
        kategori VARCHAR(50) NOT NULL,
        warna VARCHAR(30) NOT NULL,
        nilai_min DECIMAL(6,2) NOT NULL,
        nilai_max DECIMAL(6,2) NOT NULL,
        urutan INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM penilaian_akhir');
      if (!Number(n)) {
        await db.query(
          'INSERT INTO penilaian_akhir (id, kategori, warna, nilai_min, nilai_max, urutan) VALUES ?',
          [NILAI_SEED]
        );
      }
      const [rows] = await db.query('SELECT kategori, warna, nilai_min, nilai_max FROM penilaian_akhir');
      setPenilaianAkhir(rows);
    })().catch((err) => {
      nilaiReady = null;
      throw err;
    });
  }
  return nilaiReady;
}
function readNilaiBody(body) {
  const kategori = String(body.kategori || '').trim();
  const warna = String(body.warna || '').trim();
  const nilaiMin = Number(String(body.nilai_min ?? '').replace(',', '.'));
  const nilaiMax = Number(String(body.nilai_max ?? '').replace(',', '.'));
  const urutan = Number.parseInt(body.urutan, 10);
  if (!kategori || kategori.length > 50) {
    const err = new Error('Kategori wajib diisi, maksimal 50 karakter');
    err.status = 400;
    throw err;
  }
  if (!NILAI_WARNA.includes(warna)) {
    const err = new Error('Warna harus Merah, Orange, Hijau Muda, Hijau, Hijau Tua, atau Biru');
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(nilaiMin) || !Number.isFinite(nilaiMax) || !(nilaiMin < nilaiMax)) {
    const err = new Error('Nilai minimum harus lebih kecil dari nilai maksimum');
    err.status = 400;
    throw err;
  }
  return { kategori, warna, nilai_min: nilaiMin, nilai_max: nilaiMax, urutan: Number.isFinite(urutan) ? urutan : 0 };
}
async function refreshNilai() {
  setPenilaianAkhir((await db.query('SELECT kategori, warna, nilai_min, nilai_max FROM penilaian_akhir'))[0]);
}
router.get('/penilaian-akhir', authenticateToken, authorizeRole('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    await ensurePenilaianAkhir();
    const [rows] = await db.query('SELECT * FROM penilaian_akhir ORDER BY nilai_min DESC, urutan ASC');
    res.setHeader('Cache-Control', 'no-store');
    res.json(rows);
  } catch (error) {
    console.error('Get penilaian akhir error:', error.message);
    res.status(500).json({ message: 'Gagal memuat penilaian akhir' });
  }
});
router.post('/penilaian-akhir', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('CREATE_PENILAIAN_AKHIR'), async (req, res) => {
  try {
    await ensurePenilaianAkhir();
    const row = readNilaiBody(req.body || {});
    const id = `na_${Date.now()}`;
    await db.query(
      'INSERT INTO penilaian_akhir (id, kategori, warna, nilai_min, nilai_max, urutan) VALUES (?, ?, ?, ?, ?, ?)',
      [id, row.kategori, row.warna, row.nilai_min, row.nilai_max, row.urutan]
    );
    await refreshNilai();
    res.status(201).json({ id, ...row });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error('Create penilaian akhir error:', error.message);
    res.status(500).json({ message: 'Gagal menambah penilaian akhir' });
  }
});
router.put('/penilaian-akhir/:id', authenticateToken, authorizeRole('superadmin', 'admin'), auditMiddleware('UPDATE_PENILAIAN_AKHIR'), async (req, res) => {
  try {
    await ensurePenilaianAkhir();
    const row = readNilaiBody(req.body || {});
    const [cur] = await db.query('SELECT id FROM penilaian_akhir WHERE id = ?', [req.params.id]);
    if (!cur.length) return res.status(404).json({ message: 'Kategori tidak ditemukan' });
    await db.query(
      'UPDATE penilaian_akhir SET kategori = ?, warna = ?, nilai_min = ?, nilai_max = ?, urutan = ? WHERE id = ?',
      [row.kategori, row.warna, row.nilai_min, row.nilai_max, row.urutan, req.params.id]
    );
    await refreshNilai();
    res.json({ id: req.params.id, ...row });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error('Update penilaian akhir error:', error.message);
    res.status(500).json({ message: 'Gagal mengubah penilaian akhir' });
  }
});
router.delete('/penilaian-akhir/:id', authenticateToken, authorizeRole('superadmin'), auditMiddleware('DELETE_PENILAIAN_AKHIR'), async (req, res) => {
  try {
    await ensurePenilaianAkhir();
    const [cur] = await db.query('SELECT id FROM penilaian_akhir WHERE id = ?', [req.params.id]);
    if (!cur.length) return res.status(404).json({ message: 'Kategori tidak ditemukan' });
    const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM penilaian_akhir');
    if (Number(n) <= 1) return res.status(409).json({ message: 'Minimal satu kategori penilaian harus tersisa' });
    await db.query('DELETE FROM penilaian_akhir WHERE id = ?', [req.params.id]);
    await refreshNilai();
    res.json({ message: 'Kategori dihapus' });
  } catch (error) {
    console.error('Delete penilaian akhir error:', error.message);
    res.status(500).json({ message: 'Gagal menghapus penilaian akhir' });
  }
});
ensurePenilaianAkhir().catch((err) => console.error('penilaian akhir seed', err.message));
ensurePolaritas().catch((err) => console.error('polaritas seed', err.message));

const {
  getPeriodeSettings,
  savePeriodeSettings,
} = require('../lib/periode-kalender');

/** Periode & Kalender — bulan tutup buku mengunci edit realisasi/target di KPI Individu. */
router.get('/periode-kalender', authenticateToken, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getPeriodeSettings(db));
  } catch (error) {
    console.error('Get periode-kalender error:', error.message);
    res.status(500).json({ message: 'Gagal memuat pengaturan periode' });
  }
});

router.put(
  '/periode-kalender',
  authenticateToken,
  authorizeRole('superadmin', 'admin'),
  auditMiddleware('UPDATE_PERIODE_KALENDER'),
  async (req, res) => {
    try {
      const saved = await savePeriodeSettings(db, req.body || {});
      res.json(saved);
    } catch (error) {
      console.error('Save periode-kalender error:', error.message);
      res.status(500).json({ message: 'Gagal menyimpan pengaturan periode' });
    }
  }
);

module.exports = router;
