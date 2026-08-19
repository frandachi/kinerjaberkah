const db = require('./db.js');
const fs = require('fs');
const crypto = require('crypto');

async function updateKpiCS() {
  try {
    console.log('Connected to the database.');

    const kpiData = JSON.parse(fs.readFileSync('./kpi_cs.json', 'utf-8'));
    const csKpis = kpiData['Customer Service'];

    if (!csKpis || csKpis.length === 0) {
      throw new Error('KPI Customer Service tidak ditemukan di kpi_cs.json');
    }

    // Ambil kombinasi unik Jabatan dan Unit untuk Customer Service di Cabang
    const [pegawaiList] = await db.query(`
      SELECT DISTINCT jabatan, unit_name 
      FROM users 
      WHERE jabatan LIKE '%Customer Service%' 
      AND (unit_name LIKE 'Cabang %' OR unit_name LIKE 'Cabang Pembantu %' OR unit_name LIKE 'Cabang Koordinator %' OR unit_name LIKE 'Cabang Syariah %')
    `);

    console.log(`Found ${pegawaiList.length} distinct Jabatan-Unit combinations for Customer Service in Cabang.`);

    if (pegawaiList.length === 0) {
      console.log('No Customer Service found in Cabang.');
      process.exit(0);
    }

    // Ambil strategy_id dan parent_kpi_id dari salah satu sampel
    const [sampleKpis] = await db.query(`SELECT strategy_id, parent_kpi_id FROM kpis WHERE jabatan LIKE '%Pemimpin Cabang%' LIMIT 1`);
    const strategyId = sampleKpis.length > 0 ? sampleKpis[0].strategy_id : null;
    const parentKpiId = sampleKpis.length > 0 ? sampleKpis[0].parent_kpi_id : null;

    let deletedCount = 0;
    let insertedCount = 0;

    for (const pegawai of pegawaiList) {
      const { jabatan, unit_name } = pegawai;

      // Hapus KPI lama untuk Jabatan & Unit ini
      const [deleteResult] = await db.query(
        `DELETE FROM kpis WHERE jabatan = ? AND unit_name = ?`,
        [jabatan, unit_name]
      );
      deletedCount += deleteResult.affectedRows;

      // Determine unit_type string based on unit_name
      let unitType = 'Kantor Cabang';
      if (unit_name.includes('Cabang Pembantu')) {
        unitType = 'Kantor Cabang Pembantu';
      } else if (unit_name.includes('Cabang Koordinator')) {
        unitType = 'Kantor Cabang Koordinator';
      } else if (unit_name.includes('Cabang Syariah')) {
        unitType = 'Kantor Cabang Syariah';
      }

      // Persiapkan data KPI baru
      const batch = csKpis.map(kpi => {
        const id = crypto.randomUUID();
        
        // Tentukan Perspektif berdasarkan nama KPI
        let perspective = 'internal_process';
        const lowerName = kpi.name.toLowerCase();
        
        if (lowerName.includes('feebase') || lowerName.includes('dpk') || lowerName.includes('transaksi') && lowerName.includes('pendapatan')) {
          perspective = 'financial';
        } else if (lowerName.includes('kepuasan') || lowerName.includes('pelanggan') || lowerName.includes('layanan teller') || lowerName.includes('nasabah')) {
          perspective = 'customer';
        } else if (lowerName.includes('culture') || lowerName.includes('skill')) {
          perspective = 'learning_growth';
        }

        return [
          id,
          kpi.name,
          perspective,
          kpi.unit,
          kpi.target,
          0, // actual
          kpi.weight,
          unit_name,
          jabatan,
          strategyId,
          null, // manual_indeks
          JSON.stringify(Array(12).fill(null)), // monthly_data
          unitType,
          parentKpiId,
          'Draft' // status
        ];
      });

      // Insert batch
      if (batch.length > 0) {
        await db.query(
          `INSERT INTO kpis (id, name, perspective, unit, target, actual, weight, unit_name, jabatan, strategy_id, manual_indeks, monthly_data, unit_type, parent_kpi_id, status) VALUES ?`,
          [batch]
        );
        insertedCount += batch.length;
      }
    }

    console.log('\\nSuccess!');
    console.log(`Deleted ${deletedCount} old KPIs.`);
    console.log(`Inserted ${insertedCount} new KPIs for Customer Service (Cabang).`);

  } catch (error) {
    console.error('Error updating KPI CS:', error);
  } finally {
    console.log('Database connection closed.');
    process.exit(0);
  }
}

updateKpiCS();
