const db = require('./db.js');
const fs = require('fs');
const crypto = require('crypto');

async function updateKpiAO() {
  try {
    console.log('Connected to the database.');

    const kpiData = JSON.parse(fs.readFileSync('./kpi_ao.json', 'utf-8'));
    const aoKpis = kpiData['Account Officer'];

    if (!aoKpis || aoKpis.length === 0) {
      throw new Error('KPI Account Officer tidak ditemukan di kpi_ao.json');
    }

    // Ambil kombinasi unik Jabatan dan Unit untuk Account Officer di Cabang Koordinator
    const [pegawaiList] = await db.query(`
      SELECT DISTINCT jabatan, unit_name 
      FROM users 
      WHERE jabatan LIKE '%Account Officer%' 
      AND unit_name LIKE 'Cabang Koordinator %'
    `);

    console.log(`Found ${pegawaiList.length} distinct Jabatan-Unit combinations for Account Officer in Cabang Koordinator.`);

    if (pegawaiList.length === 0) {
      console.log('No Account Officer found in Cabang Koordinator.');
      process.exit(0);
    }

    // Ambil strategy_id dan parent_kpi_id dari salah satu sampel untuk mengisi data kpi (seperti di update_kpi_pelaksana.js)
    const [sampleKpis] = await db.query(`SELECT strategy_id, parent_kpi_id FROM kpis WHERE jabatan = 'Pemimpin Cabang Koordinator' LIMIT 1`);
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

      // Persiapkan data KPI baru
      const batch = aoKpis.map(kpi => {
        const id = crypto.randomUUID();
        
        // Tentukan Perspektif berdasarkan nama KPI
        let perspective = 'internal_process';
        const lowerName = kpi.name.toLowerCase();
        
        if (lowerName.includes('kredit') || lowerName.includes('syariah') || lowerName.includes('npl') || lowerName.includes('kolektibilitas') || lowerName.includes('pembiayaan')) {
          perspective = 'financial';
        } else if (lowerName.includes('kepuasan') || lowerName.includes('pelanggan')) {
          perspective = 'customer';
        } else if (lowerName.includes('culture') || lowerName.includes('skill')) {
          perspective = 'learning_growth';
        }

        // Tipe unit disesuaikan dengan string "Cabang Koordinator"
        const unitType = 'Kantor Cabang Koordinator';

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
    console.log(`Inserted ${insertedCount} new KPIs for Account Officer (Cabang Koordinator).`);

  } catch (error) {
    console.error('Error updating KPI AO:', error);
  } finally {
    console.log('Database connection closed.');
    process.exit(0);
  }
}

updateKpiAO();
