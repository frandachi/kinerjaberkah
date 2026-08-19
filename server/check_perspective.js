const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'kpi_corporate'
};

async function checkPerspective() {
  const connection = await mysql.createConnection(dbConfig);
  
  const [perspectives] = await connection.query(`
    SELECT DISTINCT perspective 
    FROM kpis 
    WHERE unit_name LIKE '%Pembantu%' OR unit_name LIKE '%KCP%'
  `);
  
  console.log("Perspectives in Cabang Pembantu:");
  console.table(perspectives);

  await connection.end();
}

checkPerspective();