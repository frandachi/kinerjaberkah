const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'kpi_corporate',
});

async function fixLearningGrowth() {
  try {
    console.log('Memperbarui Objective dan Nama KPI untuk Learning & Growth...');

    // 1. Update L2
    const [resL2] = await pool.query(`
      UPDATE kpis 
      SET objective = 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi',
          name = 'L2.2 # Training Mandays',
          weight = 5
      WHERE perspective = 'learning_growth' 
        AND name LIKE '%Training Mandays%'
    `);
    console.log(`Update L2 (Training Mandays): ${resL2.affectedRows} baris diperbarui.`);

    // 2. Update L3
    const [resL3] = await pool.query(`
      UPDATE kpis 
      SET objective = 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan',
          name = 'L3.1 # Culture Implementation Index',
          weight = 5
      WHERE perspective = 'learning_growth' 
        AND name LIKE '%Culture%'
    `);
    console.log(`Update L3 (Culture): ${resL3.affectedRows} baris diperbarui.`);

    console.log('✅ Berhasil menyelaraskan teks L&G dengan Peta Strategi!');
  } catch (error) {
    console.error('Error updating L&G:', error);
  } finally {
    pool.end();
  }
}

fixLearningGrowth();