const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function fix() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'kpi_corporate'
  });

  const [objs] = await connection.query("SELECT name, divisi FROM objectives");
  console.log(objs);

  await connection.end();
}
fix();