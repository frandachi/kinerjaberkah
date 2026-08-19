const mysql = require('mysql2/promise');
require('dotenv').config({ path: './server/.env' });

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'kpi_corporate'
  });

  const queries = [
    "ALTER TABLE strategies ADD COLUMN description TEXT",
    "ALTER TABLE strategies ADD COLUMN formula TEXT",
    "ALTER TABLE strategies ADD COLUMN weight DECIMAL(5,2)",
    "ALTER TABLE strategies ADD COLUMN target VARCHAR(255)"
  ];

  for (const q of queries) {
    try {
      await connection.query(q);
      console.log("Success: " + q);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log("Already exists: " + q);
      } else {
        console.error("Error: " + e.message);
      }
    }
  }

  await connection.end();
}
migrate();