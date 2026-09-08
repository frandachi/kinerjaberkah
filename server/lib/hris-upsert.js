const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');

const BCRYPT_ROUNDS = 12;

function mapHrisRow(row) {
  const npp = String(row.nrik || row.npp || '').trim();
  const name = String(row.nama || row.name || '').trim();
  const jabatan = String(row.nm_jabatan || row.jabdef || row.jabatan || '').trim();
  const unit_name = String(row.nm_unit_kerja || row.ukerdef || row.unit_name || '').trim();
  const username = String(row.nama_login || row.username || npp).trim() || npp;
  return { npp, name, jabatan, unit_name, username };
}

async function upsertPegawaiFromHris(row, connection = db) {
  const mapped = mapHrisRow(row);
  if (!mapped.npp || !mapped.name) {
    return null;
  }

  const [existing] = await connection.query('SELECT id FROM pegawai WHERE npp = ? LIMIT 1', [mapped.npp]);
  if (existing.length > 0) {
    const id = existing[0].id;
    await connection.query(
      'UPDATE pegawai SET name=?, jabatan=?, unit_name=? WHERE id=?',
      [mapped.name, mapped.jabatan, mapped.unit_name, id]
    );
    return { id, ...mapped, inserted: false };
  }

  const id = crypto.randomUUID();
  await connection.query(
    'INSERT INTO pegawai (id, name, npp, jabatan, unit_name) VALUES (?, ?, ?, ?, ?)',
    [id, mapped.name, mapped.npp, mapped.jabatan, mapped.unit_name]
  );
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

  if (!user) {
    const hashed = await bcrypt.hash(passwordPlain || npp, BCRYPT_ROUNDS);
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

async function syncPegawaiList(rows) {
  let inserted = 0;
  let updated = 0;
  let usersCreated = 0;

  const connection = await db.getConnection();
  await connection.beginTransaction();
  try {
    for (const row of rows) {
      const pegawai = await upsertPegawaiFromHris(row, connection);
      if (!pegawai) continue;

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
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return { inserted, updated, usersCreated };
}

module.exports = {
  mapHrisRow,
  upsertPegawaiFromHris,
  ensureUserFromPegawai,
  upsertFromHrisLogin,
  syncPegawaiList,
};
