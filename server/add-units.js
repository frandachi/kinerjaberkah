require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'pasiongo_kinerjaberkah',
  password: process.env.DB_PASSWORD || 'V.6cx@6yRf_=S)*',
  database: process.env.DB_NAME || 'pasiongo_kinerjaberkah'
});

async function addUnits() {
  try {
    const units = [
      'Departemen Hukum',
      'Departemen Marketing Communication',
      'Departemen Perlindungan Konsumen',
      'UKK Comercial Business Center',
      'UKK Internal Control over Financial Report',
      'Unit Audit Internal Syariah',
      'Unit Keamanan dan Ketahan Siber',
      'Unit Kepatuhan Syariah',
      'Unit Manajemen Risiko Syariah',
      'Unit Pengendalian Gratifikasi'
    ];

    for (const unit of units) {
      console.log(`Checking ${unit}...`);
      const [rows] = await pool.query('SELECT id FROM pegawai WHERE unit_name = ? LIMIT 1', [unit]);
      if (rows.length === 0) {
        console.log(`Inserting dummy pegawai for ${unit}...`);
        await pool.query('INSERT INTO pegawai (id, name, npp, jabatan, unit_name) VALUES (?, ?, ?, ?, ?)', [
          `dummy-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          '-',
          '-',
          '-',
          unit
        ]);
      }
    }
    
    console.log('Update finished successfully.');
  } catch (error) {
    console.error('Error updating units:', error);
  } finally {
    await pool.end();
  }
}

addUnits();