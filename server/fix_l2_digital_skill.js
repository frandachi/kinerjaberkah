const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'kpi_corporate',
});

async function fixL2() {
  try {
    console.log('Memperbaiki L2.2 # Training Mandays menjadi L2.1 Digital Skill Index...');

    const [resL2] = await pool.query(`
      UPDATE kpis 
      SET name = 'L2.1 # Digital Skill Index',
          target = '>= 80',
          unit = 'Skor'
      WHERE perspective = 'learning_growth' 
        AND name = 'L2.2 # Training Mandays'
    `);
    
    console.log(`Update L2.1 (Digital Skill Index): ${resL2.affectedRows} baris diperbarui di seluruh unit kerja.`);
    console.log('✅ Selesai!');
  } catch (error) {
    console.error('Error updating L2:', error);
  } finally {
    pool.end();
  }
}

fixL2();