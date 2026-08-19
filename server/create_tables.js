const mysql = require('mysql2/promise');

async function createTables() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'pasiongo_kinerjaberkah',
    password: 'V.6cx@6yRf_=S)*',
    database: 'pasiongo_kinerjaberkah'
  });

  try {
    console.log('Connected to database. Creating tables...');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS satuans (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table satuans created successfully');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS targets (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table targets created successfully');

    // Insert default satuans if empty
    const [satuansRows] = await connection.query('SELECT COUNT(*) as count FROM satuans');
    if (satuansRows[0].count === 0) {
      await connection.query(`
        INSERT INTO satuans (id, name) VALUES 
        ('sat_1', '%'),
        ('sat_2', 'Angka'),
        ('sat_3', 'Rp'),
        ('sat_4', 'Skor')
      `);
      console.log('Default satuans inserted');
    }

  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    await connection.end();
    console.log('Database connection closed.');
  }
}

createTables();
