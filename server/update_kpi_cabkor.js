const db = require('./db.js');
const fs = require('fs');
const crypto = require('crypto');

async function updateKpiCabkor() {
  try {
    console.log('Connected to the database.');

    const kpiData = JSON.parse(fs.readFileSync('./kpi_cabkor.json', 'utf-8'));

    // Ambil kombinasi unik Jabatan dan Unit untuk Cabang Koordinator
    const [pegawaiList] = await db.query(`
      SELECT DISTINCT jabatan, unit_name 
      FROM users 
      WHERE unit_name LIKE 'Cabang Koordinator %'
    `);

    console.log(`Found ${pegawaiList.length} distinct Jabatan-Unit combinations in Cabang Koordinator.`);

    if (pegawaiList.length === 0) {
      console.log('No users found in Cabang Koordinator.');
      process.exit(0);
    }

    // Ambil strategy_id dan parent_kpi_id dari salah satu sampel
    const [sampleKpis] = await db.query(`SELECT strategy_id, parent_kpi_id FROM kpis WHERE jabatan LIKE '%Pemimpin Cabang%' LIMIT 1`);
    const strategyId = sampleKpis.length > 0 ? sampleKpis[0].strategy_id : null;
    const parentKpiId = sampleKpis.length > 0 ? sampleKpis[0].parent_kpi_id : null;

    let deletedCount = 0;
    let insertedCount = 0;
    let matchedJabatans = new Set();

    function findMatch(dbJabatan) {
      const normalizedDb = dbJabatan.toUpperCase()
        .replace('ND - ', '')
        .replace('PLS - ', '')
        .replace(' KELAS 1', '')
        .replace(' KELAS 2', '')
        .replace('&', 'DAN')
        .trim();
      
      let bestMatch = null;
      let exactMatch = null;

      for (const [kpiJabatan, kpis] of Object.entries(kpiData)) {
        const normalizedKpi = kpiJabatan.toUpperCase()
          .replace(/\r\n/g, ' ')
          .replace('MANAGAER', 'MANAGER')
          .trim();
        
        // Exact match
        if (normalizedKpi === normalizedDb) {
           exactMatch = kpis;
           break; // Exact match is best
        }
        
        // Specific checks for substring
        if (normalizedKpi.includes(normalizedDb) || normalizedDb.includes(normalizedKpi)) {
          // Prevent generic matches matching longer titles incorrectly
          if (normalizedDb === 'PEMIMPIN SEKSI' && normalizedKpi !== 'PEMIMPIN SEKSI') continue;
          if (normalizedDb === 'CUSTOMER SERVICE' && normalizedKpi === 'HEAD CUSTOMER SERVICE') continue;
          if (normalizedDb === 'CUSTOMER SERVICE CABANG' && normalizedKpi === 'HEAD CUSTOMER SERVICE') continue;

          // For Relationship Manager mapping
          if (normalizedDb.includes('RELATIONSHIP MANAGER') && normalizedKpi.includes('RELATIONSHIP MANAGER')) {
             bestMatch = kpis;
          } else if (normalizedDb.includes(normalizedKpi)) {
             bestMatch = kpis;
          }
        }
      }
      
      if (exactMatch) return exactMatch;
      if (bestMatch) return bestMatch;

      // Specific fallbacks
      if (normalizedDb === 'HEAD TELLER' || normalizedDb === 'HEAD TELLER CS') return kpiData['Head Teller CS'];
      if (normalizedDb === 'CUSTOMER SERVICE CABANG') return kpiData['Customer Service'];
      if (normalizedDb === 'BACK OFFICE') return kpiData['Back Office'];
      
      return null;
    }

    for (const pegawai of pegawaiList) {
      const { jabatan, unit_name } = pegawai;
      const matchedKpis = findMatch(jabatan);

      if (!matchedKpis) {
        continue;
      }
      
      matchedJabatans.add(jabatan);

      // Hapus KPI lama untuk Jabatan & Unit ini
      const [deleteResult] = await db.query(
        `DELETE FROM kpis WHERE jabatan = ? AND unit_name = ?`,
        [jabatan, unit_name]
      );
      deletedCount += deleteResult.affectedRows;

      const unitType = 'Kantor Cabang Koordinator';

      // Persiapkan data KPI baru
      const batch = matchedKpis.map(kpi => {
        const id = crypto.randomUUID();
        
        // Tentukan Perspektif berdasarkan nama KPI
        let perspective = 'internal_process';
        const lowerName = kpi.name.toLowerCase();
        
        if (
          lowerName.includes('laba') || 
          lowerName.includes('kredit') || 
          lowerName.includes('cost') || 
          lowerName.includes('dana') || 
          lowerName.includes('dpk') || 
          lowerName.includes('pembiayaan') ||
          lowerName.includes('npl') ||
          lowerName.includes('fee') ||
          lowerName.includes('pendapatan') ||
          lowerName.includes('rasio')
        ) {
          perspective = 'financial';
        } else if (
          lowerName.includes('kepuasan') || 
          lowerName.includes('pelanggan') || 
          lowerName.includes('layanan') || 
          lowerName.includes('nasabah') ||
          lowerName.includes('rekening')
        ) {
          perspective = 'customer';
        } else if (
          lowerName.includes('culture') || 
          lowerName.includes('skill') ||
          lowerName.includes('kompetensi') ||
          lowerName.includes('training')
        ) {
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
    console.log(`Matched Jabatans:`, Array.from(matchedJabatans));
    console.log(`Deleted ${deletedCount} old KPIs.`);
    console.log(`Inserted ${insertedCount} new KPIs for Cabang Koordinator.`);

  } catch (error) {
    console.error('Error updating KPI Cabkor:', error);
  } finally {
    console.log('Database connection closed.');
    process.exit(0);
  }
}

updateKpiCabkor();
