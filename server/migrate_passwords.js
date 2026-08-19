const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'kpi_corporate',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function migratePasswords() {
  try {
    console.log('Starting password migration to bcrypt...');
    const [users] = await pool.query('SELECT id, username, password FROM users');
    console.log(`Found ${users.length} users to check.`);

    let updatedCount = 0;
    for (const user of users) {
      // Check if password is not already a bcrypt hash (bcrypt hashes usually start with $2a$, $2b$, or $2y$)
      if (!user.password || !user.password.startsWith('$2')) {
        // Decode base64 to get original password
        let originalPassword = 'password'; // default fallback
        try {
          if (user.password) {
             originalPassword = Buffer.from(user.password, 'base64').toString('utf8');
             // Sanity check: if decoded is completely gibberish, maybe it wasn't base64, but we'll assume it was based on previous code
          }
        } catch (e) {
          console.warn(`Could not decode password for user ${user.username}, using default 'password'`);
        }

        // Hash with bcrypt
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(originalPassword, salt);

        // Update database
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
        updatedCount++;
        console.log(`Updated password for user: ${user.username}`);
      }
    }

    console.log(`Password migration completed successfully. Updated ${updatedCount} users.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migratePasswords();
