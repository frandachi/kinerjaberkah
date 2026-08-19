const mysql = require('mysql2/promise');
require('dotenv').config();

async function init() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await connection.query(`
    CREATE TABLE IF NOT EXISTS objectives (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      perspective VARCHAR(100) NOT NULL,
      description TEXT,
      divisi TEXT
    );
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS strategies (
      id VARCHAR(50) PRIMARY KEY,
      objective_id VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      perspective VARCHAR(100) NOT NULL,
      unit VARCHAR(50),
      FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE CASCADE
    );
  `);

  console.log("Tables created successfully");
  process.exit(0);
}

init().catch(console.error);