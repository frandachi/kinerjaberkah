const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'kpi_corporate'
};

async function checkPegawai() {
  const connection = await mysql.createConnection(dbConfig);
  
  const [pegawai] = await connection.query(`
    SELECT jabatan, unit_name 
    FROM pegawai 
    WHERE unit_name LIKE '%Pembantu%' OR unit_name LIKE '%KCP%'
    LIMIT 5
  `);
  
  console.log("Sample Pegawai:");
  console.table(pegawai);

  await connection.end();
}

checkPegawai();