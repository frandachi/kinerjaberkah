const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

    const jsonPath = path.join(__dirname, '../kpi_pelaksana.json');
    const kpiData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const pelaksanaTemplate = kpiData.find(d => d.jabatan === 'Pelaksana');

    if (!pelaksanaTemplate) {
      console.error('Pelaksana template not found in JSON');
      process.exit(1);
    }

    const [pegawaiList] = await connection.query(`
      SELECT DISTINCT jabatan, unit_name 
      FROM users 
      WHERE jabatan LIKE '%Pelaksana%' 
      AND (unit_name LIKE 'Cabang %' OR unit_name LIKE 'Cabang Pembantu %' OR unit_name LIKE 'Cabang Koordinator %' OR unit_name LIKE 'Cabang Syariah %')
    `);

    console.log(`Found ${pegawaiList.length} distinct Jabatan-Unit combinations for Pelaksana.`);

    let updatedCount = 0;
    let deletedCount = 0;

    for (const p of pegawaiList) {
      const template = pelaksanaTemplate.kpis;
      
      const [existing] = await connection.query(
        'SELECT id FROM kpis WHERE jabatan = ? AND unit_name = ?',
        [p.jabatan, p.unit_name]
      );
      
      if (existing.length > 0) {
        await connection.query(
          'DELETE FROM kpis WHERE jabatan = ? AND unit_name = ?',
          [p.jabatan, p.unit_name]
        );
        deletedCount += existing.length;
      }

      for (const kpi of template) {
        const id = crypto.randomUUID();
        
        let perspective = 'internal_process';
        const lowerName = kpi.name.toLowerCase();
        if (lowerName.includes('fee') || lowerName.includes('dpk') || lowerName.includes('cir')) {
          perspective = 'financial';
        } else if (lowerName.includes('kepuasan') || lowerName.includes('pelanggan')) {
          perspective = 'customer';
        } else if (lowerName.includes('culture') || lowerName.includes('skill')) {
          perspective = 'learning_growth';
        }
        
        await connection.query(`
          INSERT INTO kpis (id, jabatan, unit_name, name, unit, weight, target, perspective)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id, p.jabatan, p.unit_name, kpi.name, kpi.unit, kpi.weight, kpi.target, perspective
        ]);
        updatedCount++;
      }
    }

    console.log(`\nSuccess!`);
    console.log(`Deleted ${deletedCount} old KPIs.`);
    console.log(`Inserted ${updatedCount} new KPIs for Pelaksana.`);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

updateKPIs();
