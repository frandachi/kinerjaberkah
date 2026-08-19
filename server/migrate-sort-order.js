/**
 * Tambah kolom sort_order dan backfill urutan per unit+jabatan.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env.production'), quiet: true });
require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true, quiet: true });
const db = require('./db');

async function migrate() {
  const connection = await db.getConnection();
  try {
    const [cols] = await connection.query("SHOW COLUMNS FROM kpis LIKE 'sort_order'");
    if (cols.length === 0) {
      await connection.query('ALTER TABLE kpis ADD COLUMN sort_order INT NOT NULL DEFAULT 0');
      console.log('Kolom sort_order ditambahkan.');
    } else {
      console.log('Kolom sort_order sudah ada.');
    }

    const [groups] = await connection.query(`
      SELECT unit_name, jabatan
      FROM kpis
      GROUP BY unit_name, jabatan
    `);

    let updated = 0;
    for (const group of groups) {
      const [rows] = await connection.query(
        'SELECT id FROM kpis WHERE unit_name = ? AND jabatan = ? ORDER BY sort_order ASC, created_at ASC, name ASC, id ASC',
        [group.unit_name, group.jabatan]
      );
      for (let i = 0; i < rows.length; i += 1) {
        await connection.query('UPDATE kpis SET sort_order = ? WHERE id = ?', [i, rows[i].id]);
        updated += 1;
      }
    }

    console.log(`Backfill sort_order selesai: ${updated} baris.`);
  } finally {
    connection.release();
    await db.end();
  }
}

migrate().catch((err) => {
  console.error('Migration gagal:', err.message);
  process.exit(1);
});
