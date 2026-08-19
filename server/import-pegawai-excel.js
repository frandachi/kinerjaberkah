/**
 * Import/sync pegawai from Excel.
 * Usage: node import-pegawai-excel.js [path-to-xlsx]
 */
const xlsx = require('xlsx');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.production'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true, quiet: true });
const db = require('./db');

async function importPegawaiExcel() {
  const filePath = process.argv[2] || path.join(__dirname, '../BEST - Data Pegawai.xlsx');
  console.log('Membaca file Excel:', filePath);

  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  console.log(`Berhasil membaca ${data.length} baris dari sheet "${wb.SheetNames[0]}".`);

  const [existing] = await db.query('SELECT id, npp FROM pegawai');
  const existingMap = new Map(existing.map((p) => [String(p.npp).trim(), p.id]));

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    for (const row of data) {
      const npp = row.NPP?.toString().trim();
      const name = row.Nama?.toString().trim();
      const jabatan = row.Jabatan?.toString().trim() || '';
      const unit_name = row['Unit Kerja']?.toString().trim() || '';

      if (!npp || !name) {
        skippedCount++;
        continue;
      }

      const existingId = existingMap.get(npp);
      if (existingId) {
        await connection.query(
          'UPDATE pegawai SET name = ?, jabatan = ?, unit_name = ? WHERE id = ?',
          [name, jabatan, unit_name, existingId]
        );
        await connection.query(
          'UPDATE users SET name = ?, jabatan = ?, unit_name = ? WHERE pegawai_id = ?',
          [name, jabatan, unit_name, existingId]
        );
        updatedCount++;
      } else {
        const newId = crypto.randomUUID();
        await connection.query(
          'INSERT INTO pegawai (id, name, npp, jabatan, unit_name) VALUES (?, ?, ?, ?, ?)',
          [newId, name, npp, jabatan, unit_name]
        );
        insertedCount++;
      }
    }

    await connection.commit();
    const [totalRows] = await db.query('SELECT COUNT(*) AS total FROM pegawai');
    console.log('Import selesai.');
    console.log(`Inserted: ${insertedCount}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped (no NPP/Nama): ${skippedCount}`);
    console.log(`Total pegawai di database: ${totalRows[0].total}`);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
    await db.end();
  }
}

importPegawaiExcel().catch((err) => {
  console.error('Import gagal:', err.message);
  process.exit(1);
});
