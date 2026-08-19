const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'kpi_corporate'
};

async function fixPerspectives() {
  const connection = await mysql.createConnection(dbConfig);
  
  await connection.query(`UPDATE kpis SET perspective = 'financial' WHERE perspective = 'Financial'`);
  await connection.query(`UPDATE kpis SET perspective = 'customer' WHERE perspective = 'Customer'`);
  await connection.query(`UPDATE kpis SET perspective = 'internal_process' WHERE perspective = 'Internal Process'`);
  await connection.query(`UPDATE kpis SET perspective = 'learning_growth' WHERE perspective = 'Learning & Growth'`);
  
  console.log("Perspectives updated successfully.");

  await connection.end();
}

fixPerspectives();