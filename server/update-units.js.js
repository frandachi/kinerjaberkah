require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'pasiongo_kinerjaberkah',
  password: process.env.DB_PASSWORD || 'V.6cx@6yRf_=S)*',
  database: process.env.DB_NAME || 'pasiongo_kinerjaberkah'
});

async function updateUnits() {
  try {
    const updates = [
      { old: 'Divisi Akuntansi & Keuangan', new: 'Divisi Keuangan' },
      { old: 'Divisi Strategi dan Transformasi', new: 'Divisi Perencanaan Strategis' },
      { old: 'Divisi Sumber Daya Manusia', new: 'Divisi Human Capital' },
      { old: 'Divisi Pengawasan', new: 'Divisi Audit Internal' },
      { old: 'Divisi Kredit', new: 'Divisi SME & Commercial' },
      { old: 'Divisi Dana dan Jasa', new: 'Divisi Funding & Wealth Management' },
      { old: 'Sekretariat Perusahaan', new: 'Divisi Corporate Secretary' },
      { old: 'Divisi Tresuri', new: 'Divisi Treasury' },
      { old: 'Project Digital Banking', new: 'Divisi Digital Banking' },
      { old: 'Unit Strategi Anti Fraud', new: 'Unit Anti Fraud' }
    ];

    for (const update of updates) {
      console.log(`Updating ${update.old} to ${update.new}...`);
      await pool.query('UPDATE pegawai SET unit_name = ? WHERE unit_name = ?', [update.new, update.old]);
      await pool.query('UPDATE users SET unit_name = ? WHERE unit_name = ?', [update.new, update.old]);
      await pool.query('UPDATE kpis SET unit_name = ? WHERE unit_name = ?', [update.new, update.old]);
      await pool.query('UPDATE kpis SET unit = ? WHERE unit = ? AND unit_type = "divisi"', [update.new, update.old]); // just in case it was saved in unit column
    }
    
    console.log('Update finished successfully.');
  } catch (error) {
    console.error('Error updating units:', error);
  } finally {
    await pool.end();
  }
}

updateUnits();