const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'kpi_corporate'
};

async function checkDiff() {
  const connection = await mysql.createConnection(dbConfig);
  
  const [diff] = await connection.query(`
    SELECT u.username, u.jabatan as user_jabatan, u.unit_name as user_unit,
           p.jabatan as pegawai_jabatan, p.unit_name as pegawai_unit
    FROM users u
    JOIN pegawai p ON u.pegawai_id = p.id
    WHERE u.jabatan != p.jabatan OR u.unit_name != p.unit_name
    LIMIT 10
  `);
  
  console.log("Differences between users and pegawai:");
  console.table(diff);

  await connection.end();
}

checkDiff();