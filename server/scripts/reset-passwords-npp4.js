#!/usr/bin/env node
/**
 * Reset password semua user menjadi 4 karakter awal NPP, kecuali username 'superadmin'.
 * Kolom password lama dibackup ke tabel users_pwd_backup_<timestamp> sebelum update.
 * User tanpa NPP / NPP < 4 karakter dilewati dan dilaporkan.
 *
 * Usage (di server):
 *   node scripts/reset-passwords-npp4.js --dry-run
 *   node scripts/reset-passwords-npp4.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const bcrypt = require('bcryptjs');
const db = require('../db');

const DRY = process.argv.includes('--dry-run');
const RESUME_ARG = process.argv.find((a) => a.startsWith('--resume='));
const RESUME_TABLE = RESUME_ARG ? RESUME_ARG.slice('--resume='.length) : '';
if (RESUME_TABLE && !/^users_pwd_backup_\d{8}_\d{6}$/.test(RESUME_TABLE)) {
  console.error('Nama tabel --resume tidak valid');
  process.exit(1);
}
const EXCLUDED_USERNAME = 'superadmin';
const BCRYPT_ROUNDS = 12;

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function hasColumn(name) {
  const [rows] = await db.query('SHOW COLUMNS FROM users LIKE ?', [name]);
  return rows.length > 0;
}

async function main() {
  console.log('=== Reset password user -> 4 karakter awal NPP ===');
  console.log('Mode:', DRY ? 'DRY-RUN' : 'WRITE');
  console.log('DB:', process.env.DB_NAME, '@', process.env.DB_HOST);

  // --resume: lanjutkan run yang terputus; hanya user yang password-nya masih sama dengan backup.
  const [users] = RESUME_TABLE
    ? await db.query(
        `SELECT u.id, u.username, u.npp, u.role FROM users u JOIN \`${RESUME_TABLE}\` b ON b.id = u.id
         WHERE LOWER(TRIM(u.username)) <> ? AND u.password <=> b.password ORDER BY u.username`,
        [EXCLUDED_USERNAME]
      )
    : await db.query(
        'SELECT id, username, npp, role FROM users WHERE LOWER(TRIM(username)) <> ? ORDER BY username',
        [EXCLUDED_USERNAME]
      );
  if (RESUME_TABLE) console.log('Resume dari backup:', RESUME_TABLE);
  const [[{ excluded }]] = await db.query(
    'SELECT COUNT(*) AS excluded FROM users WHERE LOWER(TRIM(username)) = ?',
    [EXCLUDED_USERNAME]
  );

  const targets = [];
  const skipped = [];
  for (const u of users) {
    const npp = String(u.npp == null ? '' : u.npp).trim();
    if (npp.length < 4) skipped.push({ username: u.username, npp });
    else targets.push({ id: u.id, username: u.username, pwd: npp.slice(0, 4) });
  }

  console.log(`Dikecualikan (username '${EXCLUDED_USERNAME}'): ${excluded}`);
  console.log(`Target reset: ${targets.length}`);
  console.log(`Dilewati (NPP kosong / < 4 karakter): ${skipped.length}`);
  skipped.slice(0, 50).forEach((s) => console.log(`  - ${s.username} (npp='${s.npp}')`));
  targets.slice(0, 5).forEach((t) => console.log(`  contoh: ${t.username} -> ${t.pwd}`));

  if (DRY) {
    await db.end();
    return;
  }

  const backupTable = RESUME_TABLE || `users_pwd_backup_${stamp()}`;
  if (!RESUME_TABLE) {
    await db.query(`CREATE TABLE \`${backupTable}\` AS SELECT id, username, npp, password FROM users`);
  }
  console.log(`Backup password lama: ${backupTable}`);

  const resetLock = (await hasColumn('failed_attempts')) && (await hasColumn('locked_until'));
  const hashCache = new Map();
  let updated = 0;

  for (const t of targets) {
    let hash = hashCache.get(t.pwd);
    if (!hash) {
      hash = await bcrypt.hash(t.pwd, BCRYPT_ROUNDS);
      hashCache.set(t.pwd, hash);
    }
    const sql = resetLock
      ? 'UPDATE users SET password = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?'
      : 'UPDATE users SET password = ? WHERE id = ?';
    const [r] = await db.query(sql, [hash, t.id]);
    updated += r.affectedRows;
    if (updated % 100 === 0) console.log(`  ... ${updated}`);
  }

  console.log(`Selesai. Password direset: ${updated}`);
  console.log(`Rollback: UPDATE users u JOIN \`${backupTable}\` b ON b.id = u.id SET u.password = b.password;`);
  await db.end();
}

main().catch(async (err) => {
  console.error('ERROR:', err.message);
  try { await db.end(); } catch (e) { /* ignore */ }
  process.exit(1);
});
