const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.DATABASE_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || process.env.DATABASE_PORT || '3306', 10),
  user: process.env.DB_USER || process.env.DATABASE_USER || 'root',
  password: process.env.DB_PASS || process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '',
  database: process.env.DB_NAME || process.env.DATABASE_NAME || 'kpi_corporate',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

module.exports = pool;
