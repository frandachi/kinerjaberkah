const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function cleanJabatanName(name) {
  if (!name) return name;
  let cleaned = name;
  
  // Remove prefix "ND - " or "PLS - " (case insensitive, handle spacing)
  cleaned = cleaned.replace(/^(ND|PLS)\s*-\s*/i, '').trim();
  // Handle case where there's no dash, just "ND " or "PLS "
  cleaned = cleaned.replace(/^(ND|PLS)\s+/i, '').trim();
  
  // If the result is empty or just the original acronyms, it might just mean "Pelaksana"
  if (cleaned.toUpperCase() === 'ND' || cleaned === '') {
    cleaned = 'Pelaksana'; // As fallback
  }
  
  return cleaned;
}

async function runCleanup() {
  console.log('--- Memulai Pembersihan Jabatan (ND / PLS) ---');
  
  // 1. Update pegawai.json
  const pegawaiPath = path.join(__dirname, '../src/data/pegawai.json');
  const pegawaiData = JSON.parse(fs.readFileSync(pegawaiPath, 'utf8'));
  let pegawaiUpdatedCount = 0;
  
  pegawaiData.forEach(p => {
    if (p.jabatan) {
      const cleaned = cleanJabatanName(p.jabatan);
      if (cleaned !== p.jabatan) {
        p.jabatan = cleaned;
        pegawaiUpdatedCount++;
      }
    }
  });
  
  if (pegawaiUpdatedCount > 0) {
    fs.writeFileSync(pegawaiPath, JSON.stringify(pegawaiData, null, 2));
    console.log(`Pegawai JSON diupdate: ${pegawaiUpdatedCount} record diubah.`);
  } else {
    console.log('Tidak ada perubahan di pegawai.json');
  }

  // 2. Update database `users`
  const conn = await mysql.createConnection({host: 'localhost', user: 'root', database: 'kpi_corporate'});
  const [users] = await conn.query('SELECT id, jabatan FROM users');
  let usersUpdatedCount = 0;
  
  for (const user of users) {
    if (user.jabatan) {
      const cleaned = cleanJabatanName(user.jabatan);
      if (cleaned !== user.jabatan) {
        await conn.query('UPDATE users SET jabatan = ? WHERE id = ?', [cleaned, user.id]);
        usersUpdatedCount++;
      }
    }
  }
  console.log(`Database users diupdate: ${usersUpdatedCount} baris diubah.`);

  // 3. Update database `kpis` (if any uploaded under ND or PLS)
  const [kpis] = await conn.query('SELECT id, jabatan, unit_name FROM kpis');
  let kpisUpdatedCount = 0;
  let kpisDeletedCount = 0;
  
  for (const kpi of kpis) {
    if (kpi.jabatan) {
      const cleaned = cleanJabatanName(kpi.jabatan);
      if (cleaned !== kpi.jabatan) {
        // Cek apakah data kpi dengan jabatan definitif sudah ada di unit yang sama
        const [existing] = await conn.query('SELECT id FROM kpis WHERE jabatan = ? AND unit_name = ? AND id != ?', [cleaned, kpi.unit_name, kpi.id]);
        if (existing.length > 0) {
          // Kalau sudah ada definitifnya, yang ND/PLS kita hapus saja biar tidak ganda
          await conn.query('DELETE FROM kpis WHERE id = ?', [kpi.id]);
          kpisDeletedCount++;
        } else {
          // Kalau belum ada, kita ubah namanya menjadi definitif
          await conn.query('UPDATE kpis SET jabatan = ? WHERE id = ?', [cleaned, kpi.id]);
          kpisUpdatedCount++;
        }
      }
    }
  }
  console.log(`Database kpis diupdate: ${kpisUpdatedCount} diubah menjadi definitif, ${kpisDeletedCount} dihapus karena duplikat.`);

  conn.end();
  console.log('--- Selesai ---');
}

runCleanup().catch(console.error);