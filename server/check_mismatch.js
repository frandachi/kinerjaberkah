const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'kpi_corporate'
};

async function checkMismatch() {
  const connection = await mysql.createConnection(dbConfig);
  
  const [mismatched] = await connection.query(`
    SELECT DISTINCT p.jabatan as pegawai_jabatan, p.unit_name as pegawai_unit, 
           k.jabatan as kpi_jabatan, k.unit_name as kpi_unit
    FROM pegawai p
    LEFT JOIN kpis k ON p.jabatan = k.jabatan AND p.unit_name = k.unit_name
    WHERE p.unit_name LIKE '%Pembantu%' OR p.unit_name LIKE '%KCP%'
    LIMIT 10
  `);
  
  console.log("Match Check:");
  console.table(mismatched);

  await connection.end();
}

checkMismatch();