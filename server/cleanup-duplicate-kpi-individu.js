/**
 * Hapus KPI template lama (non-pegawai) yang duplikat dengan KPI individu (pegawai).
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env.production'), quiet: true });
require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true, quiet: true });
const db = require('./db');

async function cleanup() {
  const connection = await db.getConnection();
  await connection.beginTransaction();
  try {
    const [result] = await connection.query(`
      DELETE FROM kpis
      WHERE unit_type <> 'pegawai'
        AND EXISTS (
          SELECT 1 FROM (
            SELECT 1 FROM kpis p
            WHERE p.unit_name = kpis.unit_name
              AND p.jabatan = kpis.jabatan
              AND p.unit_type = 'pegawai'
          ) AS dup
        )
    `);
    await connection.commit();
    const [remaining] = await db.query("SELECT COUNT(*) AS total FROM kpis WHERE unit_type = 'pegawai'");
    console.log(`KPI template duplikat dihapus: ${result.affectedRows}`);
    console.log(`Sisa KPI individu (pegawai): ${remaining[0].total}`);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
    await db.end();
  }
}

cleanup().catch((err) => {
  console.error('Cleanup gagal:', err.message);
  process.exit(1);
});
