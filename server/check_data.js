const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'kpi_corporate'
};

async function checkData() {
  const connection = await mysql.createConnection(dbConfig);
  
  const [users] = await connection.query(`
    SELECT jabatan, unit_name 
    FROM users 
    WHERE unit_name LIKE '%Pembantu%' OR unit_name LIKE '%KCP%'
    LIMIT 5
  `);
  
  console.log("Sample Users:");
  console.table(users);
  
  const [kpis] = await connection.query(`
    SELECT jabatan, unit_name, count(*) as kpi_count
    FROM kpis 
    WHERE unit_name LIKE '%Pembantu%' OR unit_name LIKE '%KCP%'
    GROUP BY jabatan, unit_name
    LIMIT 5
  `);
  
  console.log("Sample KPIs:");
  console.table(kpis);

  await connection.end();
}

checkData();
