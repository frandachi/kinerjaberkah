const fs = require('fs');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'kpi_corporate',
  multipleStatements: true
};

function getPerspective(kpiName) {
  const n = kpiName.toLowerCase();
  if (n.includes('culture') || n.includes('skill')) return 'learning_growth';
  if (n.includes('audit') || n.includes('komplain') || n.includes('sistem') || n.includes('sop') || n.includes('kesalahan') || n.includes('leadtime') || n.includes('tata kelola') || n.includes('klaim')) return 'internal_process';
  if (n.includes('nasabah') || n.includes('pelanggan') || n.includes('kepuasan') || n.includes('layanan')) return 'customer';
  return 'financial';
}

function matchJabatan(dbJabatan, jsonJabatan) {
  const dbJ = dbJabatan.toLowerCase().trim();
  const jsJ = jsonJabatan.toLowerCase().trim();
  
  if (dbJ === jsJ) return true;
  
  // Custom mappings
  if (dbJ.includes('pemimpin cabang koordinator') && jsJ === 'pemimpin cabang koordinator') return true;
  if (dbJ.includes('pemimpin operasional cabang') && jsJ === 'wakil pemimpin operasional cabang') return true;
  if (dbJ.includes('kredit produktif') && jsJ === 'pemimpin seksi kredit produktif dan dana') return true;
  if ((dbJ === 'senior relationship manager' || dbJ === 'relationship manager') && jsJ === 'srm/rm/arm') return true;
  if (dbJ === 'account officer senior' && jsJ === 'account officer') return true;
  if (dbJ === 'customer service cabang' && jsJ === 'customer service') return true;
  if (dbJ === 'teller cabang koordinator' && jsJ === 'teller') return true;
  if (dbJ === 'pelaksana' && jsJ === 'back office') return true;
  if (dbJ === 'head teller cs' && jsJ === 'head teller') return true;
  if (dbJ === 'pemimpin seksi pemasaran dana' && jsJ === 'pemimpin seksi konsumer') return true;
  if (dbJ === 'pemimpin seksi' && jsJ === 'pemimpin seksi operasional') return true;
  
  return false;
}

async function run() {
  const connection = await mysql.createConnection(dbConfig);
  
  // Load JSON
  const kckData = JSON.parse(fs.readFileSync('../kpi_kck.json', 'utf8'));
  
  // Get all unique Cabang Koordinator jabatan and unit_name combinations
  const [roleUnitList] = await connection.query(`SELECT DISTINCT jabatan, unit_name FROM pegawai WHERE unit_name LIKE '%Koordinator%';`);
  
  console.log(`Found ${roleUnitList.length} distinct jabatan-unit combinations in Cabang Koordinator.`);
  
  let inserted = 0;
  let deleted = 0;
  
  for (const p of roleUnitList) {
    // Find matching jabatan in JSON
    let matchedJson = null;
    for (const j of kckData) {
      if (matchJabatan(p.jabatan, j.jabatan)) {
        matchedJson = j;
        break;
      }
    }
    
    if (matchedJson) {
      // Delete existing KPIs for this jabatan & unit combination (because KPIs are bound to jabatan + unit)
      // Actually, wait, KPIs in DB are bound to unit_name and jabatan. Let's delete existing ones for this unit and db jabatan.
      const [delRes] = await connection.query(`DELETE FROM kpis WHERE unit_name = ? AND jabatan = ?`, [p.unit_name, p.jabatan]);
      deleted += delRes.affectedRows;
      
      // Insert new KPIs
      for (const k of matchedJson.kpis) {
        await connection.query(
          `INSERT INTO kpis (id, name, perspective, unit, target, weight, unit_name, jabatan, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Draft')`,
          [
            crypto.randomUUID(),
            k.name,
            getPerspective(k.name),
            k.unit,
            k.target,
            k.weight,
            p.unit_name,
            p.jabatan
          ]
        );
        inserted++;
      }
      console.log(`Updated KPIs for ${p.jabatan} at ${p.unit_name}`);
    } else {
      console.log(`No match for DB jabatan: '${p.jabatan}'`);
    }
  }
  
  console.log(`Finished! Deleted ${deleted} old KPIs, Inserted ${inserted} new KPIs.`);
  
  await connection.end();
}

run().catch(console.error);
