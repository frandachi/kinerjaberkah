const mysql = require('mysql2/promise');
require('dotenv').config({ path: './server/.env' });

async function updateDb() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'kpi_corporate'
  });

  try {
    console.log('Connected. Altering table...');
    // check if divisi exists, if not add it, if yes modify it
    await connection.query('ALTER TABLE objectives MODIFY COLUMN divisi TEXT');
    console.log('Success');
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      try {
        await connection.query('ALTER TABLE objectives ADD COLUMN divisi TEXT');
        console.log('Added divisi column');
      } catch (e) {
        console.error('Error adding column:', e.message);
      }
    } else {
      console.error('Error altering table:', error.message);
    }
  } finally {
    await connection.end();
  }
}
updateDb();