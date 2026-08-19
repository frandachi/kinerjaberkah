const mysql = require('mysql2/promise');
require('dotenv').config({ path: './server/.env' });

async function checkDb() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'kpi_corporate'
  });

  try {
    const [rows] = await connection.query("SHOW COLUMNS FROM strategies");
    console.log(rows.map(r => r.Field).join(', '));
  } catch (e) {
    console.error(e.message);
  } finally {
    await connection.end();
  }
}
checkDb();