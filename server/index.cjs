require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const db = require('./db.cjs');

const app = express();
const PORT = process.env.PORT || 5555;
const JWT_SECRET = process.env.JWT_SECRET || 'KunciRahasiaKpiCorporate2026!';

// --- 1. Middleware Pengecekan Lisensi ---
const checkLicense = (req, res, next) => {
  console.log(`[DEBUG] 1. License Check: ${req.url}`);
  // Tetap true agar tidak hang saat migrasi
  const isLicenseValid = true; 
  if (isLicenseValid) {
    next();
  } else {
    res.status(403).json({ message: 'License Invalid' });
  }
};

// --- 2. Middleware Verifikasi Token (Auth) ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log(`[DEBUG] 2. Auth Check: ${req.url}`);

  if (!token) {
    console.log("[DEBUG] Auth GAGAL: Token tidak ada");
    return res.status(401).json({ message: 'Unauthorized' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log(`[DEBUG] Auth GAGAL: ${err.message}`);
      return res.status(401).json({ message: 'Sesi berakhir' });
    }
    req.user = user;
    console.log(`[DEBUG] Auth SUKSES: User ${user.username}`);
    next();
  });
};

// --- Middleware Global ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Jalankan Lisensi secara Global
app.use(checkLicense);

// --- 3. Endpoints System (Hapus prefix /api agar sinkron dengan Nginx) ---
app.get('/system/license', (req, res) => {
  console.log("[DEBUG] 3. Mengirim data lisensi");
  res.json({ expired: false, activated: true });
});

// --- 4. Auth Endpoints ---
// 1. Sesuaikan rute login (hapus /api jika Nginx memotongnya, atau sesuaikan dengan Frontend)
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length > 0) {
      const user = users[0];
      
      // GANTI BCRYPT MENJADI MD5 (Agar sinkron dengan DB server Anda)
      const crypto = require('crypto');
      const hashInput = crypto.createHash('md5').update(password).digest('hex');
      

      if (hashInput === user.password) {
        const token = jwt.sign(
          { id: user.id, username: user.username, role: user.role, name: user.name },
          JWT_SECRET, { expiresIn: '24h' }
        );
        delete user.password;
        res.json({ user, token });
      } else {
        res.status(401).json({ message: 'Password salah' });
      }
    } else {
      res.status(401).json({ message: 'User tidak ditemukan' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. PERBAIKAN REFRESH: Hapus '/api' agar Nginx tidak 404
app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, name, username, role FROM users WHERE id = ?', [req.user.id]);
    if (users.length > 0) {
      // Bungkus dalam object 'user' agar dashboard terbaca
      res.json({ user: users[0] });
    } else {
      res.status(404).json({ message: 'User tidak ditemukan' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
        

// --- 5. Rute Data (Hapus prefix /api) ---
app.get('/kpis', authenticateToken, async (req, res) => {
  // Log ini akan memberitahu kita apa yang dibawa oleh Token Farah
  console.log(`[DEBUG] Request KPI dari User: ${req.user.username}`);
  console.log(`[DEBUG] Jabatan dari Token: "${req.user.jabatan}"`);
  console.log(`[DEBUG] Unit dari Token: "${req.user.unit_name}"`);

  try {
    // Gunakan TRIM untuk menghindari spasi tak terlihat di filter
    const [rows] = await db.query(
      'SELECT * FROM kpis WHERE TRIM(jabatan) = ? AND TRIM(unit_name) = ?', 
      [req.user.jabatan.trim(), req.user.unit_name.trim()]
    );

    console.log(`[DEBUG] Database Query Berhasil. Ditemukan: ${rows.length} baris.`);

    // Pastikan monthly_data di-parse agar tidak error di Frontend
    const results = rows.map(item => ({
      ...item,
      monthly_data: typeof item.monthly_data === 'string' ? JSON.parse(item.monthly_data) : item.monthly_data
    }));

    res.json(results);
  } catch (error) {
    console.error("[DEBUG] Error Database KPI:", error.message);
    res.status(500).json({ message: "Gagal memuat KPI Individu" });
  }
});

// --- 6. Gunakan authenticateToken agar hanya yang login bisa lihat data
app.get('/pegawai', authenticateToken, async (req, res) => {
  try {
    console.log("[DEBUG] Mengambil data pegawai dari database...");
    
    // Sesuaikan nama tabel. Jika data pegawai ada di tabel 'users', gunakan 'users'
    const [rows] = await db.query('SELECT id, name, npp, jabatan, unit_name, role FROM users WHERE role != "superadmin"');
    
    console.log(`[DEBUG] Berhasil mengirim ${rows.length} data pegawai`);
    res.json(rows);
  } catch (error) {
    console.error("[DEBUG] ERROR Database Pegawai:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// --- 7.  Rute untuk mengambil data Parameter
app.get('/parameters', authenticateToken, async (req, res) => {
  try {
    console.log("[DEBUG] Mengambil data Parameter...");
    
    // Sesuaikan nama tabel di database Anda
    const [rows] = await db.query('SELECT * FROM parameters'); 
    
    console.log(`[DEBUG] Berhasil mengirim ${rows.length} data parameter`);
    res.json(rows);
  } catch (error) {
    console.error("[DEBUG] Error Parameter:", error.message);
    res.status(500).json({ message: "Gagal mengambil data parameter" });
  }
});

// --- 8.  Rute untuk Update Parameter (biasanya dibutuhkan di menu ini)
app.put('/parameters/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { value } = req.body;
  try {
    await db.query('UPDATE parameters SET value = ? WHERE id = ?', [value, id]);
    res.json({ success: true, message: "Parameter diperbarui" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- 9. Rute-rute Menu Parameter ---

// 1. Objectives
app.get('/objectives', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM objectives');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Strategies
app.get('/strategies', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM strategies');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. Satuans
app.get('/satuans', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM satuans');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 4. Targets
app.get('/targets', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM targets');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 5. Users (Data Pegawai di menu Parameter)
app.get('/users', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, username, role, jabatan, unit_name FROM users');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- 10. Endpoint Sinkronisasi KPI ke Parameter ---
app.post('/parameters/sync-from-kpi', authenticateToken, async (req, res) => {
  console.log("[DEBUG] Memulai proses sinkronisasi KPI...");
  try {
    // 1. Ambil data unik dari tabel kpis
    const [kpis] = await db.query(`
      SELECT 
        TRIM(objective) as objective, 
        TRIM(name) as name, 
        perspective, unit, description, formula, weight, target
      FROM kpis 
      WHERE status != 'Deleted'
      GROUP BY objective, name, perspective, unit, description, formula, weight, target
    `);

    for (const kpi of kpis) {
      if (!kpi.objective && !kpi.name) continue;
      
      const objName = kpi.objective || `Tujuan Strategis - ${kpi.perspective}`;
      
      // 2. Cek atau Buat Objective (Tujuan Strategis)
      let [existingObj] = await db.query('SELECT id FROM objectives WHERE name = ? AND perspective = ?', [objName, kpi.perspective]);
      let objectiveId;
      
      if (existingObj.length === 0) {
        objectiveId = 'obj_' + Date.now() + Math.floor(Math.random() * 1000);
        await db.query(
          'INSERT INTO objectives (id, name, perspective, description) VALUES (?, ?, ?, ?)',
          [objectiveId, objName, kpi.perspective, '']
        );
      } else {
        objectiveId = existingObj[0].id;
      }

      // 3. Cek atau Buat Strategy (Indikator KPI)
      let [existingStrategy] = await db.query('SELECT id FROM strategies WHERE name = ? AND objective_id = ?', [kpi.name, objectiveId]);
      
      if (existingStrategy.length === 0) {
        const strategyId = 'strat_' + Date.now() + Math.floor(Math.random() * 1000);
        await db.query(
          'INSERT INTO strategies (id, objective_id, name, perspective, unit, description, formula, weight, target) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [strategyId, objectiveId, kpi.name, kpi.perspective, kpi.unit || '%', kpi.description || '', kpi.formula || '', kpi.weight || null, kpi.target || null]
        );
      } else {
        // Update data jika sudah ada
        await db.query(
          'UPDATE strategies SET weight = COALESCE(?, weight), target = COALESCE(?, target) WHERE id = ?', 
          [kpi.weight || null, kpi.target || null, existingStrategy[0].id]
        );
      }
    }

    console.log("[DEBUG] Sinkronisasi Berhasil ✅");
    res.json({ message: 'Sinkronisasi Berhasil' });
  } catch (error) {
    console.error("[DEBUG] Sinkronisasi GAGAL ❌:", error.message);
    res.status(500).json({ message: 'Gagal sinkronisasi: ' + error.message });
  }
});

// --- 11. Get mutation history for a pegawai ---
// Sesuaikan dari '/api/mutations/:pegawai_id' menjadi:
app.get('/mutations/:pegawai_id', authenticateToken, async (req, res) => {
  console.log(`[DEBUG] 2. Auth Check: /mutations/${req.params.pegawai_id}`);
  try {
    const [mutations] = await db.query(
      'SELECT * FROM mutation_history WHERE pegawai_id = ? ORDER BY effective_date DESC',
      [req.params.pegawai_id]
    );

    const parsedMutations = mutations.map(m => ({
      ...m,
      old_kpi_ids: typeof m.old_kpi_ids === 'string' ? JSON.parse(m.old_kpi_ids) : m.old_kpi_ids,
      new_kpi_ids: typeof m.new_kpi_ids === 'string' ? JSON.parse(m.new_kpi_ids) : m.new_kpi_ids
    }));

    res.json(parsedMutations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- 2. Calculate prorated KPI score ---
// Sesuaikan dari '/api/mutations/:pegawai_id/calculate-score' menjadi:
app.get('/mutations/:pegawai_id/calculate-score', authenticateToken, async (req, res) => {
  console.log(`[DEBUG] 2. Auth Check: Calculate Score ${req.params.pegawai_id}`);
  try {
    const [mutations] = await db.query(
      'SELECT * FROM mutation_history WHERE pegawai_id = ? AND status = "active"',
      [req.params.pegawai_id]
    );

    if (mutations.length === 0) {
      return res.json({ hasMutation: false, score: null });
    }

    // ... (sisa kode logika perhitungan skor Anda tetap sama) ...
    // Pastikan di akhir fungsi ini Anda mengirimkan res.json(hasilPerhitungan);
    
    res.json({ hasMutation: true, finalScore: 0 }); // Contoh placeholder
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
