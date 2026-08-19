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
    const jsonPath = path.join(__dirname, '../kpi_kc.json');
    const kpiData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    // 2. Get all distinct jabatan & unit_name from users where unit is Cabang (not Pembantu, not Koordinator)
    const [pegawaiList] = await connection.query(`
      SELECT DISTINCT jabatan, unit_name 
      FROM users 
      WHERE unit_name LIKE 'Cabang %' 
      AND unit_name NOT LIKE '%Pembantu%' 
      AND unit_name NOT LIKE '%Koordinator%'
    `);

    console.log(`Found ${pegawaiList.length} distinct Jabatan-Unit combinations for Cabang.`);

    let updatedCount = 0;
    let deletedCount = 0;
    let notMatched = [];

    // Helper to standardize perspective string
    const getPerspective = (p) => {
      if (!p) return 'financial';
      const lowerP = p.toLowerCase().trim();
      if (lowerP.includes('finan')) return 'financial';
      if (lowerP.includes('custom') || lowerP.includes('pelanggan') || lowerP.includes('nasabah')) return 'customer';
      if (lowerP.includes('internal') || lowerP.includes('process') || lowerP.includes('proses')) return 'internal process';
      if (lowerP.includes('learning') || lowerP.includes('growth') || lowerP.includes('culture') || lowerP.includes('skill')) return 'learning & growth';
      return 'financial';
    };

    // Helper to get perspective from the JSON template if provided, else deduce it
    const getTemplatePerspective = (kpi) => {
      if (kpi.perspective) return kpi.perspective.toLowerCase().trim();
      return getPerspective(kpi.name);
    };

    // 3. Process each combination
    for (const p of pegawaiList) {
      const jabatanLower = p.jabatan.toLowerCase();
      let matchedJabatan = null;

      // Matching Logic
      if (jabatanLower.includes('wakil pemimpin cabang')) {
        matchedJabatan = 'Wakil Pemimpin Cabang';
      } else if (jabatanLower.includes('pemimpin cabang')) {
        matchedJabatan = 'Pemimpin Cabang';
      } else if (jabatanLower.includes('pemimpin seksi kredit produktif')) {
        matchedJabatan = 'Pemimpin Seksi Kredit Produktif & Dana';
      } else if (jabatanLower.includes('pemimpin seksi konsumer')) {
        matchedJabatan = 'Pemimpin Seksi Konsumer';
      } else if (jabatanLower.includes('pemimpin seksi operasional')) {
        matchedJabatan = 'Pemimpin Seksi Operasional';
      } else if (jabatanLower.includes('pemimpin seksi pelayanan')) {
        matchedJabatan = 'Pemimpin Seksi Pelayanan Nasabah';
      } else if (jabatanLower.includes('pemimpin unit layanan prioritas')) {
        matchedJabatan = 'Pemimpin Unit Layanan Prioritas';
      } else if (jabatanLower.includes('pemimpin payment point')) {
        matchedJabatan = 'Pemimpin Payment Point';
      } else if (jabatanLower.includes('teller payment point')) {
        matchedJabatan = 'Teller Payment Point';
      } else if (jabatanLower.includes('pemimpin kas mobil')) {
        matchedJabatan = 'Pemimpin Kas Mobil';
      } else if (jabatanLower.includes('operator kas mobil')) {
        matchedJabatan = 'Operator Kas Mobil';
      } else if (jabatanLower.includes('head teller')) {
        matchedJabatan = 'Head Teller';
      } else if (jabatanLower.includes('teller')) {
        matchedJabatan = 'Teller';
      } else if (jabatanLower.includes('customer service') || jabatanLower.includes('cs')) {
        matchedJabatan = 'Customer Service';
      } else if (jabatanLower.includes('funding sales officer')) {
        matchedJabatan = 'Funding Sales Officer';
      } else if (jabatanLower.includes('account officer konsumer')) {
        matchedJabatan = 'Account Officer Konsumer';
      } else if (jabatanLower.includes('account officer') || jabatanLower.includes('ao')) {
        matchedJabatan = 'Account Officer';
      } else if (jabatanLower.includes('srm') || jabatanLower.includes('rm') || jabatanLower.includes('arm') || jabatanLower.includes('relationship manager')) {
        matchedJabatan = 'SRM/RM/ARM';
      } else if (jabatanLower.includes('back office') || jabatanLower.includes('bo')) {
        matchedJabatan = 'Back Office';
      } else if (jabatanLower.includes('pemimpin operasional')) {
        matchedJabatan = 'Pemimpin Seksi Operasional';
      } else if (jabatanLower.includes('pemimpin seksi pembiayaan produktif')) {
        matchedJabatan = 'Pemimpin Seksi Kredit Produktif & Dana';
      } else if (jabatanLower.includes('pemimpin seksi')) {
         // Some default for pemimpin seksi? Or skip
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
                getTemplatePerspective(k),
                k.unit,
                k.target,
                k.weight,
                p.unit_name,
                p.jabatan
              ]
            );
            updatedCount++;
          }
        } else {
           notMatched.push(`${p.jabatan} -> matched to ${matchedJabatan} but no template found`);
        }
      } else {
        notMatched.push(p.jabatan);
      }
    }

    console.log(`\nKPI update completed!`);
    console.log(`Deleted ${deletedCount} old KPIs.`);
    console.log(`Inserted ${updatedCount} new KPIs.`);
    
    if (notMatched.length > 0) {
      console.log(`\nCould not match/find templates for the following Jabatans (${notMatched.length}):`);
      // Only print unique unmapped jabatans
      const uniqueNotMatched = [...new Set(notMatched)];
      uniqueNotMatched.forEach(j => console.log(`- ${j}`));
    }

  } catch (error) {
    console.error('Error updating KPIs:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

updateKPIs();