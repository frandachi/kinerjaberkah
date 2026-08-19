/**
 * Tambah kolom polarity ke tabel kpis (default: maximize).
 * Jalankan: node migrate-polarity.js
 */
require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [cols] = await connection.query("SHOW COLUMNS FROM kpis LIKE 'polarity'");
    if (cols.length === 0) {
      await connection.query(
        "ALTER TABLE kpis ADD COLUMN polarity VARCHAR(20) NOT NULL DEFAULT 'maximize' AFTER unit"
      );
      console.log('Kolom polarity ditambahkan.');
    } else {
      console.log('Kolom polarity sudah ada.');
    }

    const [result] = await connection.query(
      "UPDATE kpis SET polarity = 'maximize' WHERE polarity IS NULL OR polarity = ''"
    );
    console.log(`Backfill polarity selesai: ${result.affectedRows} baris diperbarui.`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
