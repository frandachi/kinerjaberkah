const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || process.env.DB_PASSWORD || 'V.6cx@6yRf_=S)*',
  database: process.env.DB_NAME || 'kpi_db',
  connectionLimit: 10, // Menjaga 10 koneksi tetap standby
  queueLimit: 0,
  waitForConnections: true
});

module.exports = db;

// Tambahkan ini di akhir file db.js
db.getConnection()
  .then(conn => {
    console.log("[DEBUG] Database terhubung dengan Pool ✅");
    conn.release();
  })
  .catch(err => {
    console.error("[DEBUG] Database TIDAK TERHUBUNG ❌:", err.message);
  });
