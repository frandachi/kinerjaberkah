const mysql = require('mysql2/promise');
const fs = require('fs');

async function updateKpiCapem() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kpi_corporate'
  });

  try {
    // 1. Read the parsed JSON
    const kpiData = JSON.parse(fs.readFileSync('../kpi_capem.json', 'utf8'));
    const targetJabatans = Object.keys(kpiData);
    
    console.log(`Mencari unit "Cabang Pembantu" untuk ${targetJabatans.length} jabatan...`);

    // 2. Find all Cabang Pembantu units in the database
    // We can look at users table or kpis table where unit_name LIKE '%Cabang Pembantu%'
    // It's safer to find existing combinations of unit_name and jabatan in the kpis table
    const placeholders = targetJabatans.map(() => '?').join(',');
    const [rows] = await connection.query(
      `SELECT DISTINCT unit_name, jabatan FROM kpis 
       WHERE jabatan IN (${placeholders}) 
       AND unit_name LIKE '%Cabang Pembantu%'`,
      targetJabatans
    );

    console.log(`Ditemukan ${rows.length} kombinasi unit-jabatan di Cabang Pembantu yang akan diupdate.`);

    if (rows.length === 0) {
      console.log('Tidak ada data yang perlu diupdate.');
      return;
    }

    // 3. Begin transaction
    await connection.beginTransaction();

    let deletedCount = 0;
    let insertedCount = 0;

    for (const row of rows) {
      const { unit_name, jabatan } = row;
      const kpisToInsert = kpiData[jabatan];

      if (!kpisToInsert) continue;

      // Delete existing KPIs for this specific unit and jabatan
      const [deleteResult] = await connection.query(
        'DELETE FROM kpis WHERE unit_name = ? AND jabatan = ?',
        [unit_name, jabatan]
      );
      deletedCount += deleteResult.affectedRows;

      // Insert new KPIs
      const kpiValues = kpisToInsert.map((kpi, index) => [
        'kpi_capem_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '_' + index,
        kpi.name, 
        kpi.perspective, 
        kpi.unit, 
        kpi.target || '0', 
        0, // actual
        kpi.weight || 0,
        unit_name, 
        jabatan, 
        null, // strategy_id
        null, // manual_indeks
        JSON.stringify({}), // monthly_data
        'Cabang Pembantu', // unit_type
        null, // parent_kpi_id
        'Draft' // status
      ]);

      if (kpiValues.length > 0) {
        const [insertResult] = await connection.query(
          'INSERT INTO kpis (id, name, perspective, unit, target, actual, weight, unit_name, jabatan, strategy_id, manual_indeks, monthly_data, unit_type, parent_kpi_id, status) VALUES ?',
          [kpiValues]
        );
        insertedCount += insertResult.affectedRows;
      }
    }

    await connection.commit();
    console.log('--- RINGKASAN UPDATE ---');
    console.log(`✅ Berhasil menghapus ${deletedCount} KPI lama.`);
    console.log(`✅ Berhasil memasukkan ${insertedCount} KPI baru dari file Capem.xlsx.`);
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Terjadi kesalahan, transaksi dibatalkan:', error);
  } finally {
    await connection.end();
  }
}

updateKpiCapem();
