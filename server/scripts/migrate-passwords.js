require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db');

const BCRYPT_ROUNDS = 12;

const isBcryptHash = (hash) => {
  return hash && (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$'));
};

async function migratePasswords() {
  console.log('Starting password migration...');

  try {
    const [users] = await db.query('SELECT id, password FROM users');
    console.log(`Found ${users.length} users`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      if (isBcryptHash(user.password)) {
        skipped++;
        continue;
      }

      try {
        const hashedPassword = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
        migrated++;
        console.log(`✓ Migrated user ${user.id}`);
      } catch (error) {
        errors++;
        console.error(`✗ Error migrating user ${user.id}: ${error.message}`);
      }
    }

    console.log('\nMigration complete!');
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped (already bcrypt): ${skipped}`);
    console.log(`Errors: ${errors}`);

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migratePasswords();
