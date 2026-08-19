const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Database configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'kpi_corporate'
};

async function updateKPIs() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to the database.');

    // 1. Read the JSON file
    const jsonPath = path.join(__dirname, '../kpi_kcp.json');
    const kpiData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    // 2. Get all distinct jabatan & unit_name from users where unit is Cabang Pembantu (KCP)
    const [pegawaiList] = await connection.query(`
      SELECT DISTINCT jabatan, unit_name 
      FROM users 
      WHERE unit_name LIKE '%Pembantu%' OR unit_name LIKE '%KCP%'
    `);

    console.log(`Found ${pegawaiList.length} distinct jabatan-unit combinations in Cabang Pembantu.`);

    let deletedCount = 0;
    let insertedCount = 0;

    // Helper to determine perspective based on KPI name
    const getPerspective = (kpiName) => {
      const lower = kpiName.toLowerCase();
      if (lower.includes('laba') || lower.includes('pendapatan') || lower.includes('cost') || lower.includes('o/s') || lower.includes('pembiayaan') || lower.includes('dpk') || lower.includes('npl') || lower.includes('fee') || lower.includes('kredit')) {
        return 'financial';
      }
      if (lower.includes('layanan') || lower.includes('kepuasan') || lower.includes('pelanggan') || lower.includes('nasabah')) {
        return 'customer';
      }
      if (lower.includes('audit') || lower.includes('akurasi') || lower.includes('kesalahan') || lower.includes('agunan') || lower.includes('klaim') || lower.includes('pipeline') || lower.includes('referral') || lower.includes('akuisisi')) {
        return 'internal_process';
      }
      if (lower.includes('culture') || lower.includes('digital') || lower.includes('kompetensi')) {
        return 'learning_growth';
      }
      return 'financial'; // default
    };

    // 3. Process each employee group
    for (const p of pegawaiList) {
      let matchedJabatan = null;

      // Logic to match the employee's jabatan with the ones in our JSON
      const pJabatan = p.jabatan.toLowerCase();

      if (pJabatan.includes('pemimpin cabang pembantu') || pJabatan === 'pemimpin kcp') {
        matchedJabatan = 'Pemimpin Cabang Pembantu';
      } else if (pJabatan.includes('wakil pemimpin cabang pembantu')) {
        matchedJabatan = 'Wakil Pemimpin Cabang Pembantu';
      } else if (pJabatan.includes('seksi bisnis')) {
        matchedJabatan = 'Pemimpin Seksi Bisnis';
      } else if (pJabatan.includes('account officer senior') || pJabatan.includes('account officer')) {
        matchedJabatan = 'Account Officer';
      } else if (pJabatan.includes('funding sales officer')) {
        matchedJabatan = 'Funding Sales Officer';
      } else if (pJabatan.includes('seksi pelayanan') || pJabatan.includes('operasional')) {
        matchedJabatan = 'Pemimpin Seksi Pelayanan & Operasional';
      } else if (pJabatan.includes('teller') || pJabatan.includes('head teller')) {
        matchedJabatan = 'Teller';
      } else if (pJabatan.includes('customer service') || pJabatan.includes('cs')) {
        matchedJabatan = 'Customer Service';
      } else if (pJabatan.includes('back office') || pJabatan.includes('pelaksana')) {
        matchedJabatan = 'Back Office';
      }

      if (matchedJabatan) {
        // Find the KPI template for this matched jabatan
        const template = kpiData.find(item => item.jabatan === matchedJabatan);
        
        if (template) {
          // Delete existing KPIs for this jabatan & unit_name
          const [deleteResult] = await connection.query(
            'DELETE FROM kpis WHERE jabatan = ? AND unit_name = ?',
            [p.jabatan, p.unit_name]
          );
          deletedCount += deleteResult.affectedRows;

          // Insert new KPIs
          for (const k of template.kpis) {
            await connection.query(
              `INSERT INTO kpis (id, name, perspective, unit, target, weight, unit_name, jabatan, status) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Draft')`,
              [
                crypto.randomUUID(),
                k.name,
                getPerspective(k.name),
                k.unit,
                k.target,
                k.weight,
                p.unit_name,
                p.jabatan
              ]
            );
            insertedCount++;
          }
          console.log(`Updated KPIs for ${p.jabatan} at ${p.unit_name} (Matched to: ${matchedJabatan})`);
        }
      } else {
        // console.log(`No KPI template match found for: ${p.jabatan} at ${p.unit_name}`);
      }
    }

    console.log(`\nFinished! Deleted ${deletedCount} old KPIs, Inserted ${insertedCount} new KPIs.`);

  } catch (error) {
    console.error('Error updating KPIs:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

updateKPIs();
