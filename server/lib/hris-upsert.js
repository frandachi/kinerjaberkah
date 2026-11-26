const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');

const BCRYPT_ROUNDS = 12;
const DEFAULT_NEW_USER_PASSWORD = process.env.DEFAULT_USER_PASSWORD || 'password1122@';

/** HRIS status_peg → pegawai.status */
function mapHrisStatus(row) {
  const s = String(row.status_peg ?? row.status ?? '').trim();
  if (['1', '11', '12'].includes(s)) return 'aktif';
  if (['4', '5', '8', '9', '10'].includes(s)) return 'non_aktif';
  const text = s.toLowerCase();
  if (['aktif', 'active'].includes(text)) return 'aktif';
  if (['non_aktif', 'nonaktif', 'inactive'].includes(text)) return 'non_aktif';
  if (['pensiun', 'retired'].includes(text)) return 'pensiun';
  if (['keluar', 'resign'].includes(text)) return 'keluar';
  return 'aktif';
}

function mapHrisRow(row) {
  const npp = String(row.nrik || row.npp || '').trim();
  const name = String(row.nama || row.name || '').trim();
  const jabatan = String(row.nm_jabatan || row.jabdef || row.jabatan || '').trim();
  const unit_name = String(
    row.nm_unit_kerja || row.ukerdef || row.unit_penempatan || row.unit_name || ''
  ).trim();
  const username = String(row.nama_login || row.username || '').trim() || npp.split('.')[0] || npp;
  const status = mapHrisStatus(row);
  return { npp, name, jabatan, unit_name, username, status };
}

async function upsertPegawaiFromHris(row, connection = db) {
  const mapped = mapHrisRow(row);
  if (!mapped.npp || !mapped.name) {
    return null;
  }

  let existing = [];
  [existing] = await connection.query('SELECT id FROM pegawai WHERE npp = ? LIMIT 1', [mapped.npp]);

  // Fallback: short login as prefix of long NRIK (e.g. 2415 → 2415.xxxx)
  if (!existing.length && mapped.username && mapped.username !== mapped.npp) {
    [existing] = await connection.query(
      'SELECT id FROM pegawai WHERE npp = ? OR npp LIKE ? LIMIT 1',
      [mapped.username, `${mapped.username}.%`]
    );
  }

  if (existing.length > 0) {
    const id = existing[0].id;
    try {
      await connection.query(
        'UPDATE pegawai SET name=?, npp=?, jabatan=?, unit_name=?, status=? WHERE id=?',
        [mapped.name, mapped.npp, mapped.jabatan, mapped.unit_name, mapped.status, id]
      );
    } catch (e) {
      // Older schema without status
      await connection.query(
        'UPDATE pegawai SET name=?, npp=?, jabatan=?, unit_name=? WHERE id=?',
        [mapped.name, mapped.npp, mapped.jabatan, mapped.unit_name, id]
      );
    }
    return { id, ...mapped, inserted: false };
  }

  const id = crypto.randomUUID();
  try {
    await connection.query(
      'INSERT INTO pegawai (id, name, npp, jabatan, unit_name, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, mapped.name, mapped.npp, mapped.jabatan, mapped.unit_name, mapped.status]
    );
  } catch (e) {
    await connection.query(
      'INSERT INTO pegawai (id, name, npp, jabatan, unit_name) VALUES (?, ?, ?, ?, ?)',
      [id, mapped.name, mapped.npp, mapped.jabatan, mapped.unit_name]
    );
  }
  return { id, ...mapped, inserted: true };
}

async function ensureUserFromPegawai({
  pegawaiId,
  name,
  npp,
  jabatan,
  unit_name,
  username,
  passwordPlain,
}, connection = db) {
  const loginName = (username || npp || '').trim();
  if (!pegawaiId || !npp || !loginName) {
    throw new Error('Data user HRIS tidak lengkap');
  }

  const [byNpp] = await connection.query('SELECT * FROM users WHERE npp = ? LIMIT 1', [npp]);
  let user = byNpp[0];

  if (!user) {
    const [byUsername] = await connection.query('SELECT * FROM users WHERE username = ? LIMIT 1', [loginName]);
    user = byUsername[0];
  }

  if (!user && loginName !== npp) {
    const [byShort] = await connection.query(
      'SELECT * FROM users WHERE npp = ? OR npp LIKE ? LIMIT 1',
      [loginName, `${loginName}.%`]
    );
    user = byShort[0];
  }

  if (!user) {
    const hashed = await bcrypt.hash(passwordPlain || DEFAULT_NEW_USER_PASSWORD, BCRYPT_ROUNDS);
    const id = crypto.randomUUID();
    await connection.query(
      `INSERT INTO users (id, pegawai_id, name, username, password, jabatan, unit_name, role, supervisi_approval, npp)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'user', '', ?)`,
      [id, pegawaiId, name || '', loginName, hashed, jabatan || '', unit_name || '', npp]
    );
    const [created] = await connection.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    return { user: created[0], created: true };
  }

  const fields = ['name=?', 'jabatan=?', 'unit_name=?', 'npp=?', 'pegawai_id=?'];
  const params = [name || '', jabatan || '', unit_name || '', npp, pegawaiId];

  if (loginName && loginName !== user.username) {
    const [clash] = await connection.query(
      'SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1',
      [loginName, user.id]
    );
    if (clash.length === 0) {
      fields.push('username=?');
      params.push(loginName);
    }
  }

  if (passwordPlain) {
    const hashed = await bcrypt.hash(passwordPlain, BCRYPT_ROUNDS);
    fields.push('password=?');
    params.push(hashed);
  }

  params.push(user.id);
  await connection.query(`UPDATE users SET ${fields.join(', ')} WHERE id=?`, params);

  const [updated] = await connection.query('SELECT * FROM users WHERE id = ? LIMIT 1', [user.id]);
  return { user: updated[0], created: false };
}

async function upsertFromHrisLogin(hrisRow, passwordPlain) {
  const pegawai = await upsertPegawaiFromHris(hrisRow);
  if (!pegawai) {
    throw new Error('Data pegawai dari HRIS tidak valid');
  }
  return ensureUserFromPegawai({
    pegawaiId: pegawai.id,
    name: pegawai.name,
    npp: pegawai.npp,
    jabatan: pegawai.jabatan,
    unit_name: pegawai.unit_name,
    username: pegawai.username,
    passwordPlain,
  });
}

async function syncPegawaiList(rows, options = {}) {
  const batchSize = Number(options.batchSize || 200);
  let inserted = 0;
  let updated = 0;
  let usersCreated = 0;
  let skipped = 0;

  const connection = await db.getConnection();
  try {
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      await connection.beginTransaction();
      try {
        for (const row of chunk) {
          const pegawai = await upsertPegawaiFromHris(row, connection);
          if (!pegawai) {
            skipped += 1;
            continue;
          }

          if (pegawai.inserted) inserted += 1;
          else updated += 1;

          const result = await ensureUserFromPegawai(
            {
              pegawaiId: pegawai.id,
              name: pegawai.name,
              npp: pegawai.npp,
              jabatan: pegawai.jabatan,
              unit_name: pegawai.unit_name,
              username: pegawai.username,
            },
            connection
          );
          if (result.created) usersCreated += 1;
        }
        await connection.commit();
        console.log(`[syncPegawaiList] batch ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
      } catch (err) {
        await connection.rollback();
        throw err;
      }
    }
  } finally {
    connection.release();
  }

  return { inserted, updated, usersCreated, skipped, total: rows.length };
}

module.exports = {
  mapHrisRow,
  mapHrisStatus,
  upsertPegawaiFromHris,
  ensureUserFromPegawai,
  upsertFromHrisLogin,
  syncPegawaiList,
  DEFAULT_NEW_USER_PASSWORD,
};
