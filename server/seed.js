const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  multipleStatements: true // Allow executing multiple queries at once
};

async function seed() {
  let connection;
  try {
    console.log('Connecting to MySQL...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('Creating database if not exists...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'kpi_corporate'}`);
    await connection.query(`USE ${process.env.DB_NAME || 'kpi_corporate'}`);

    console.log('Dropping existing tables to re-seed...');
    await connection.query(`
      DROP TABLE IF EXISTS kpis;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS pegawai;
    `);

    console.log('Creating tables...');
    await connection.query(`
      CREATE TABLE pegawai (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        npp VARCHAR(100) NOT NULL,
        jabatan VARCHAR(255) NOT NULL,
        unit_name VARCHAR(255) NOT NULL
      );

      CREATE TABLE users (
        id VARCHAR(100) PRIMARY KEY,
        pegawai_id VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        npp VARCHAR(100) NOT NULL,
        jabatan VARCHAR(255) NOT NULL,
        unit_name VARCHAR(255) NOT NULL,
        supervisi_approval VARCHAR(255) NOT NULL,
        FOREIGN KEY (pegawai_id) REFERENCES pegawai(id)
      );

      CREATE TABLE kpis (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        perspective VARCHAR(100) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        target VARCHAR(255),
        actual DECIMAL(15,2) DEFAULT 0,
        weight DECIMAL(5,2) DEFAULT 0,
        unit_name VARCHAR(255) NOT NULL,
        jabatan VARCHAR(255) NOT NULL,
        strategy_id VARCHAR(50),
        manual_indeks DECIMAL(5,2),
        monthly_data JSON
      );
    `);

    console.log('Reading pegawai.json...');
    const pegawaiPath = path.join(__dirname, '../src/data/pegawai.json');
    const pegawaiData = JSON.parse(fs.readFileSync(pegawaiPath, 'utf8'));

    console.log('Reading unit_mapping.json...');
    const mappingPath = path.join(__dirname, '../unit_mapping.json');
    let unitMapping = {};
    if (fs.existsSync(mappingPath)) {
      unitMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    }

    console.log('Inserting Pegawai and Users...');
    
    // Normalization helper to convert 'Cabang Aek Kanopan' -> 'kantor cabang aek kanopan'
    const normalizeUnitName = (u) => {
      let name = (u || '').toLowerCase().trim();
      if (!name.startsWith('kantor ')) {
        name = 'kantor ' + name;
      }
      return name;
    };

    // Find a leader globally by partial job title and unit name
    const findLeaderInUnitNormalized = (normalizedUnit, leaderKeyword) => {
      const leader = pegawaiData.find(p => {
        if (!p.jabatan || !p.unit_name) return false;
        const norm = normalizeUnitName(p.unit_name);
        return norm === normalizedUnit && p.jabatan.toLowerCase().includes(leaderKeyword.toLowerCase());
      });
      return leader ? leader.name : null;
    };

    const getApproval = (pegawai) => {
      const j = (pegawai.jabatan || '').toLowerCase();
      const u = (pegawai.unit_name || '').toLowerCase();
      const normU = normalizeUnitName(u);
      
      // Direksi/Divisi level
      if (j.includes('pemimpin divisi')) return 'Direksi';
      
      // Pemimpin KCK -> Direksi/Divisi
      if (j.includes('pemimpin cabang koordinator') || j.includes('pemimpin cabang kordinator')) {
        const divLeader = pegawaiData.find(p => p.jabatan && p.jabatan.toLowerCase().includes('pemimpin divisi'));
        return divLeader ? divLeader.name : 'Pemimpin Divisi';
      }
      
      // Pemimpin KCP -> Pemimpin KC (Induk)
      if (j.includes('pemimpin cabang pembantu') || j.includes('pemimpin capem')) {
        const parentUnitNormalized = unitMapping[normU];
        if (parentUnitNormalized) {
           const parentLeader = findLeaderInUnitNormalized(parentUnitNormalized.toLowerCase(), 'pemimpin cabang');
           if (parentLeader) return parentLeader;
        }
        return 'Pemimpin Cabang Induk (Tidak Terpetakan)';
      }
      
      // Pemimpin KC -> Pemimpin KCK (Koor)
      if (j.includes('pemimpin cabang')) {
        const parentUnitNormalized = unitMapping[normU];
        if (parentUnitNormalized) {
           const parentLeader = findLeaderInUnitNormalized(parentUnitNormalized.toLowerCase(), 'pemimpin cabang koordinator');
           if (parentLeader) return parentLeader;
        }
        // Fallback to global KCK if not mapped
        const globalKCK = pegawaiData.find(p => p.jabatan && p.jabatan.toLowerCase().includes('pemimpin cabang koordinator'));
        return globalKCK ? globalKCK.name : 'Pemimpin Cabang Koordinator';
      }
      
      // Pegawai biasa (bukan pemimpin unit)
      const isLeader = j.includes('pemimpin') || j.includes('kepala');
      if (!isLeader) {
         // Submit ke pemimpin di unit yang sama
         const leader = pegawaiData.find(p => p.unit_name === pegawai.unit_name && p.jabatan && (p.jabatan.toLowerCase().includes('pemimpin') || p.jabatan.toLowerCase().includes('kepala')));
         if (leader) return leader.name;
      }
      
      return 'Atasan Tidak Ditemukan';
    };

    // Batch insert to avoid huge query limits
    const BATCH_SIZE = 500;
    
    for (let i = 0; i < pegawaiData.length; i += BATCH_SIZE) {
      const batch = pegawaiData.slice(i, i + BATCH_SIZE);
      
      const pegawaiValues = batch.map(p => [p.id, p.name || '-', p.npp || '-', p.jabatan || '-', p.unit_name || '-']);
      await connection.query('INSERT INTO pegawai (id, name, npp, jabatan, unit_name) VALUES ?', [pegawaiValues]);
      
      const userValues = batch.map(p => {
        const nppStart = p.npp ? p.npp.substring(0, 4) : Math.floor(1000 + Math.random() * 9000).toString();
        const fullNpp = p.npp || nppStart;
        // Password = jabatan lowercase tanpa spasi
        const rawPassword = (p.jabatan || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
        const encryptedPassword = Buffer.from(rawPassword).toString('base64');
        return [
          `user_${p.id}`, p.id, p.name || '-', nppStart, encryptedPassword, 'user',
          fullNpp, p.jabatan || '-', p.unit_name || '-', getApproval(p) || '-'
        ];
      });
      await connection.query('INSERT INTO users (id, pegawai_id, name, username, password, role, npp, jabatan, unit_name, supervisi_approval) VALUES ?', [userValues]);
    }

    console.log('Inserting Superadmin...');
    await connection.query(`
      INSERT INTO pegawai (id, name, npp, jabatan, unit_name) 
      VALUES ('admin_0', 'Super Administrator', 'ADMIN', 'Superadmin', 'Pusat')
      ON DUPLICATE KEY UPDATE name=name;
    `);
    
    await connection.query(`
      INSERT INTO users (id, pegawai_id, name, username, password, role, npp, jabatan, unit_name, supervisi_approval) 
      VALUES ('superadmin', 'admin_0', 'Super Administrator', 'superadmin', '${Buffer.from('superadmin').toString('base64')}', 'superadmin', 'ADMIN', 'Superadmin', 'Pusat', 'Direksi')
      ON DUPLICATE KEY UPDATE password='${Buffer.from('superadmin').toString('base64')}', role='superadmin';
    `);

    console.log('Inserting KPIs for all employees...');
    const allKpis = [];
    let kpiCounter = 1;

    const kpiTemplates = {
      managerial: [
        { name: 'Pertumbuhan Laba Bersih / Pendapatan', perspective: 'financial', unit: 'currency', target: 5000, weight: 30 },
        { name: 'Pertumbuhan Dana Pihak Ketiga (DPK)', perspective: 'financial', unit: 'currency', target: 10000, weight: 30 },
        { name: 'Indeks Kepuasan Nasabah (CSI)', perspective: 'customer', unit: 'percentage', target: 95, weight: 20 },
        { name: 'Tingkat Kepatuhan & Zero Fraud', perspective: 'internal_process', unit: 'percentage', target: 100, weight: 20 },
      ],
      sales: [
        { name: 'Pencapaian O/S Kredit / Pembiayaan Baru', perspective: 'financial', unit: 'currency', target: 2000, weight: 40 },
        { name: 'Akuisisi Nasabah Baru', perspective: 'customer', unit: 'number', target: 150, weight: 30 },
        { name: 'Penyelesaian NPL / Kredit Bermasalah', perspective: 'financial', unit: 'percentage', target: 100, weight: 20 },
        { name: 'Kunjungan / Pipeline Nasabah', perspective: 'internal_process', unit: 'number', target: 240, weight: 10 },
      ],
      operational: [
        { name: 'Akurasi Transaksi (Zero Error)', perspective: 'internal_process', unit: 'percentage', target: 100, weight: 40 },
        { name: 'SLA Pelayanan Nasabah', perspective: 'customer', unit: 'percentage', target: 95, weight: 30 },
        { name: 'Jumlah Transaksi / Dokumen yang Diproses', perspective: 'internal_process', unit: 'number', target: 12000, weight: 20 },
        { name: 'Jam Pelatihan Kompetensi', perspective: 'learning_growth', unit: 'number', target: 40, weight: 10 },
      ]
    };

    // Get unique unit_name and jabatan combinations
    const uniqueRoles = new Set();
    const roleList = [];
    
    pegawaiData.forEach(p => {
      const unit = p.unit_name || '-';
      const jabatan = p.jabatan || '-';
      const key = `${unit}|||${jabatan}`;
      
      if (!uniqueRoles.has(key)) {
        uniqueRoles.add(key);
        roleList.push({ unit_name: unit, jabatan: jabatan });
      }
    });

    roleList.forEach(role => {
      const j = (role.jabatan || '').toLowerCase();
      let templateType = 'operational';
      if (j.includes('pemimpin') || j.includes('kepala') || j.includes('direksi') || j.includes('manager')) {
        templateType = 'managerial';
      } else if (j.includes('account officer') || j.includes('sales') || j.includes('funding') || j.includes('analis') || j.includes('kredit')) {
        templateType = 'sales';
      }

      // Tentukan unit_type berdasarkan unit_name
      let unit_type = 'kcp'; // default
      const unitLower = (role.unit_name || '').toLowerCase();
      
      if (unitLower.includes('divisi')) {
        unit_type = 'divisi';
      } else if (unitLower.includes('koordinator')) {
        unit_type = 'kck';
      } else if (unitLower.includes('cabang pembantu')) {
        unit_type = 'kcp';
      } else if (unitLower.includes('cabang')) {
        unit_type = 'kc';
      }

      const templates = kpiTemplates[templateType];
      
      templates.forEach(t => {
        // Generate random realistic monthly data (approx 80-105% of target total)
        const isPercentage = t.unit === 'percentage';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
        const monthly_data = {};
        let actual = 0;

        if (isPercentage && t.target >= 95) {
          // For high percentages (like SLA, accuracy)
          months.forEach(m => {
            const val = 90 + Math.random() * 10; // 90 to 100
            monthly_data[m] = parseFloat(val.toFixed(2));
          });
          // Average for actual
          actual = parseFloat((Object.values(monthly_data).reduce((a, b) => a + b, 0) / 12).toFixed(2));
        } else {
          // For cumulative numbers/currency
          const monthlyTarget = t.target / 12;
          months.forEach(m => {
            const val = monthlyTarget * (0.8 + Math.random() * 0.4); // 80% to 120% of monthly target
            monthly_data[m] = Math.round(val);
            actual += monthly_data[m];
          });
        }

        const kpiId = `kpi_gen_${kpiCounter++}`;
        allKpis.push([
          kpiId,
          t.name,
          t.perspective,
          t.unit,
          t.target,
          actual,
          t.weight,
          role.unit_name,
          role.jabatan,
          null, // strategy_id
          null, // manual_indeks
          JSON.stringify(monthly_data),
          unit_type, // unit_type
          null, // parent_kpi_id (will establish links later if needed, but for now cascading tree works by unit_type in root and children by parent_id)
          'Draft' // status
        ]);
      });
    });

    // We need to alter the kpis table schema to add unit_type and parent_kpi_id if they don't exist yet
    await connection.query(`
      CREATE TABLE IF NOT EXISTS kpis (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255),
        perspective VARCHAR(50),
        unit VARCHAR(50),
        target DECIMAL(15,2),
        actual DECIMAL(15,2),
        weight DECIMAL(5,2),
        unit_name VARCHAR(100),
        jabatan VARCHAR(100),
        strategy_id VARCHAR(50),
        manual_indeks DECIMAL(5,2) NULL,
        monthly_data JSON,
        unit_type VARCHAR(50) DEFAULT 'pegawai',
        parent_kpi_id VARCHAR(50) NULL,
        status VARCHAR(50) DEFAULT 'Draft',
        is_locked BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (strategy_id) REFERENCES strategy_map(id) ON DELETE SET NULL,
        FOREIGN KEY (parent_kpi_id) REFERENCES kpis(id) ON DELETE SET NULL
      )
    `);

    // Add columns if they don't exist (in case the table was already created without them)
    try {
      await connection.query(`ALTER TABLE kpis ADD COLUMN unit_type VARCHAR(50) DEFAULT 'pegawai'`);
    } catch (e) { /* Ignore if exists */ }
    try {
      await connection.query(`ALTER TABLE kpis ADD COLUMN parent_kpi_id VARCHAR(50) NULL`);
      await connection.query(`ALTER TABLE kpis ADD CONSTRAINT fk_parent_kpi FOREIGN KEY (parent_kpi_id) REFERENCES kpis(id) ON DELETE SET NULL`);
    } catch (e) { /* Ignore if exists */ }
    try {
      await connection.query(`ALTER TABLE kpis ADD COLUMN status VARCHAR(50) DEFAULT 'Draft'`);
    } catch (e) { /* Ignore if exists */ }

    // Clear existing data before inserting new ones
    await connection.query('DELETE FROM kpis');

    // Batch insert KPIs
    const KPI_BATCH_SIZE = 1000;
    for (let i = 0; i < allKpis.length; i += KPI_BATCH_SIZE) {
      const batch = allKpis.slice(i, i + KPI_BATCH_SIZE);
      await connection.query('INSERT INTO kpis (id, name, perspective, unit, target, actual, weight, unit_name, jabatan, strategy_id, manual_indeks, monthly_data, unit_type, parent_kpi_id, status) VALUES ?', [batch]);
    }

    // Now, build cascading relationship (parent_kpi_id) based on hierarchy rules
    // Rule: Pegawai Biasa -> Atasan (Pemimpin di unit yang sama) -> KCP/KC/KCK -> Divisi -> Direksi
    console.log('Building KPI hierarchy (parent_kpi_id)...');
    
    // We will establish parent links by name matching for simplicity
    // 1. Map all KPIs by their unit_name and perspective to easily find parents
    const [insertedKpis] = await connection.query('SELECT id, name, perspective, unit_name, jabatan, unit_type FROM kpis');
    
    // We'll run UPDATE queries to set parent_kpi_id
    for (const kpi of insertedKpis) {
      let parentKpiId = null;
      const jLower = (kpi.jabatan || '').toLowerCase();
      const isPemimpin = jLower.includes('pemimpin') || jLower.includes('kepala') || jLower.includes('direksi');
      const unitLower = (kpi.unit_name || '').toLowerCase();
      
      // We'll find a parent KPI that matches the same perspective (to keep cascading logical: financial to financial, etc)
      
      if (!isPemimpin) {
        // Regular employee -> find Pemimpin in same unit
        const parent = insertedKpis.find(p => 
          p.unit_name === kpi.unit_name && 
          p.perspective === kpi.perspective && 
          (p.jabatan.toLowerCase().includes('pemimpin') || p.jabatan.toLowerCase().includes('kepala'))
        );
        if (parent) parentKpiId = parent.id;
      } else {
        const normU = normalizeUnitName(unitLower);
        // Leader -> cascade up based on unit type and Excel mapping
        if (kpi.unit_type === 'kcp') {
          // KCP -> KC (Induk)
          const parentUnitNormalized = unitMapping[normU];
          if (parentUnitNormalized) {
             const parent = insertedKpis.find(p => 
               normalizeUnitName(p.unit_name) === parentUnitNormalized.toLowerCase() &&
               p.perspective === kpi.perspective &&
               p.jabatan.toLowerCase().includes('pemimpin')
             );
             if (parent) parentKpiId = parent.id;
          }
        } else if (kpi.unit_type === 'kc') {
          // KC -> KCK (Koor)
          const parentUnitNormalized = unitMapping[normU];
          if (parentUnitNormalized) {
             const parent = insertedKpis.find(p => 
               normalizeUnitName(p.unit_name) === parentUnitNormalized.toLowerCase() &&
               p.perspective === kpi.perspective &&
               p.jabatan.toLowerCase().includes('pemimpin cabang koordinator')
             );
             if (parent) parentKpiId = parent.id;
          } else {
             // Fallback
             const parent = insertedKpis.find(p => 
               p.unit_type === 'kck' && 
               p.perspective === kpi.perspective &&
               p.jabatan.toLowerCase().includes('pemimpin')
             );
             if (parent) parentKpiId = parent.id;
          }
        } else if (kpi.unit_type === 'kck') {
          // KCK -> Divisi
          const parent = insertedKpis.find(p => 
            p.unit_type === 'divisi' && 
            p.perspective === kpi.perspective &&
            p.jabatan.toLowerCase().includes('pemimpin')
          );
          if (parent) parentKpiId = parent.id;
        } else if (kpi.unit_type === 'divisi') {
          // Divisi -> Direksi
          const parent = insertedKpis.find(p => 
            p.jabatan.toLowerCase().includes('direksi') && 
            p.perspective === kpi.perspective
          );
          if (parent) parentKpiId = parent.id;
        }
      }

      if (parentKpiId) {
        await connection.query('UPDATE kpis SET parent_kpi_id = ? WHERE id = ?', [parentKpiId, kpi.id]);
      }
    }


    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    console.error(error.stack);
  } finally {
    if (connection) await connection.end();
  }
}

seed();
