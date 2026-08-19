const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const inferUnitType = (unitName) => {
  if (!unitName) return 'divisi';
  const name = unitName.toUpperCase();
  if (name.includes('KCK ') || name.includes('KORDINATOR') || name.includes('KOORDINATOR')) return 'kck';
  if (name.includes('KCP ') || name.includes('CABANG PEMBANTU') || name.includes('CAPEM')) return 'kcp';
  if (name.includes('KC ') || name.includes('CABANG SYARIAH') || name.startsWith('CABANG ')) return 'kc';
  return 'divisi';
};

async function checkMissingKPIs() {
  const pegawaiPath = path.join(__dirname, '../src/data/pegawai.json');
  const pegawaiData = JSON.parse(fs.readFileSync(pegawaiPath, 'utf8'));
  
  const requiredKpis = new Map();
  pegawaiData.forEach(p => {
    if (!p.jabatan || !p.unit_name) return;
    const type = inferUnitType(p.unit_name);
    if (type !== 'divisi') {
      const key = `${p.jabatan}|${p.unit_name}`;
      if (!requiredKpis.has(key)) {
        requiredKpis.set(key, { jabatan: p.jabatan, unit_name: p.unit_name, type });
      }
    }
  });

  const conn = await mysql.createConnection({host: 'localhost', user: 'root', database: 'kpi_corporate'});
  const [kpiRows] = await conn.query('SELECT DISTINCT jabatan, unit_name FROM kpis');
  
  const existingKpis = new Set(kpiRows.map(row => `${row.jabatan}|${row.unit_name}`));

  const missing = [];
  for (const [key, info] of requiredKpis.entries()) {
    if (!existingKpis.has(key)) {
      missing.push(info);
    }
  }

  const grouped = {};
  missing.forEach(m => {
    if (!grouped[m.jabatan]) grouped[m.jabatan] = new Set();
    grouped[m.jabatan].add(m.unit_name);
  });

  console.log(`Total missing combinations (non-Divisi): ${missing.length}`);
  
  let outputText = `Total Kombinasi Jabatan & Unit (Non-Divisi) yang BELUM memiliki KPI: ${missing.length}\n\n`;
  
  for (const [jabatan, units] of Object.entries(grouped)) {
    const unitsArr = Array.from(units);
    outputText += `=== Jabatan: ${jabatan} (${unitsArr.length} unit) ===\n`;
    if (unitsArr.length > 10) {
      outputText += `Contoh Unit: ${unitsArr.slice(0, 10).join(', ')} ... dan ${unitsArr.length - 10} lainnya\n\n`;
    } else {
      outputText += `Unit: ${unitsArr.join(', ')}\n\n`;
    }
  }

  fs.writeFileSync(path.join(__dirname, 'missing_kpis_output.txt'), outputText);
  console.log('Detail ditulis ke server/missing_kpis_output.txt');
  
  conn.end();
}

checkMissingKPIs().catch(console.error);