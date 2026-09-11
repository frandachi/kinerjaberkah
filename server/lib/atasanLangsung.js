/**
 * Pemetaan Atasan Langsung berdasarkan struktur organisasi (unit kerja → jabatan Pemimpin).
 * 1. Cabang Koordinator → Pemimpin Cabang Koordinator
 * 2. Cabang → Pemimpin Cabang
 * 3. Cabang Pembantu → Pemimpin Cabang Pembantu
 * 4. Unit → Pemimpin Unit (juga Divisi/Departemen)
 */
const unitInduk = require('./unit-induk.json');

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function classifyUnit(unitName, jabatan = '') {
  const u = norm(unitName);
  const j = norm(jabatan);
  if (u.includes('koordinator') || u.includes('kordinator')) return 'kck';
  if (u.includes('cabang pembantu') || u.includes('capem')) return 'kcp';
  if (u.startsWith('cabang ') || u.includes('kantor cabang')) return 'kc';
  if (
    u.startsWith('unit ') ||
    u.includes('divisi') ||
    u.includes('departemen') ||
    u.startsWith('ukk') ||
    u.startsWith('sekretariat')
  ) {
    return 'unit';
  }
  if (j.includes('cabang koordinator') || j.includes('cabang kordinator')) return 'kck';
  if (j.includes('cabang pembantu')) return 'kcp';
  if (j.includes('cabang') && !j.includes('pembantu') && !j.includes('koordinator')) return 'kc';
  if (j.includes('unit') || j.includes('divisi') || j.includes('departemen')) return 'unit';
  return 'other';
}

function matchesPemimpinLevel(jabatan, level) {
  const j = String(jabatan || '').trim();
  if (!j) return false;
  const jl = j.toLowerCase();
  if (jl.startsWith('wakil ')) return false;

  if (level === 'kck') {
    return /^Pemimpin Cabang Ko+ordinator/i.test(j) || /^Pemimpin Cabang Kordinator/i.test(j);
  }
  if (level === 'kcp') {
    return /^Pemimpin Cabang Pembantu/i.test(j);
  }
  if (level === 'kc') {
    if (/seksi|kas mobil|payment point|laka area/i.test(j)) return false;
    return /^Pemimpin Cabang (?!Pembantu|Koordinator|Kordinator)/i.test(j);
  }
  if (level === 'unit') {
    return (
      /^Pemimpin Unit/i.test(j) ||
      /^Pemimpin Divisi/i.test(j) ||
      /^Pemimpin Departemen/i.test(j) ||
      /^Kepala Divisi/i.test(j) ||
      /^Kepala Departemen/i.test(j)
    );
  }
  return false;
}

function levelLabel(level) {
  return (
    {
      kck: 'Pemimpin Cabang Koordinator',
      kc: 'Pemimpin Cabang',
      kcp: 'Pemimpin Cabang Pembantu',
      unit: 'Pemimpin Unit',
    }[level] || null
  );
}

function parentUnitName(unitName) {
  const exact = unitInduk[unitName];
  if (exact) return exact;
  const key = Object.keys(unitInduk).find((k) => norm(k) === norm(unitName));
  return key ? unitInduk[key] : null;
}

function buildUsersByUnit(users) {
  const map = new Map();
  for (const u of users) {
    const key = norm(u.unit_name);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(u);
  }
  return map;
}

function findPemimpinInUnit(usersByUnit, unitName, level, excludeId) {
  const list = usersByUnit.get(norm(unitName)) || [];
  return (
    list.find((u) => String(u.id) !== String(excludeId) && matchesPemimpinLevel(u.jabatan, level)) ||
    null
  );
}

/**
 * @returns {{ atasan: object|null, level: string, expectedJabatan: string|null, viaParent: boolean }}
 */
function resolveAtasan(user, usersByUnit) {
  const level = classifyUnit(user.unit_name, user.jabatan);
  const expectedJabatan = levelLabel(level);
  if (level === 'other') {
    return { atasan: null, level, expectedJabatan, viaParent: false };
  }

  let atasan = findPemimpinInUnit(usersByUnit, user.unit_name, level, user.id);
  let viaParent = false;

  // Pemimpin unit tersebut: atasan = pemimpin unit induk (Cabang / KCK)
  if (!atasan && matchesPemimpinLevel(user.jabatan, level)) {
    const parent = parentUnitName(user.unit_name);
    if (parent) {
      const parentLevel = classifyUnit(parent, '');
      atasan = findPemimpinInUnit(usersByUnit, parent, parentLevel, user.id);
      viaParent = !!atasan;
    }
  }

  return { atasan, level, expectedJabatan, viaParent };
}

/**
 * @param {Array} users
 * @param {{ onlyEmpty?: boolean }} opts
 */
function planAtasanSync(users, opts = {}) {
  const onlyEmpty = !!opts.onlyEmpty;
  const usersByUnit = buildUsersByUnit(users);
  const updates = [];
  let unresolved = 0;
  let skipped = 0;

  for (const user of users) {
    const current = String(user.supervisi_approval || '').trim();
    const empty =
      !current ||
      /tidak ditemukan/i.test(current) ||
      current === '-' ||
      current.toLowerCase() === 'n/a';

    const { atasan, level, expectedJabatan, viaParent } = resolveAtasan(user, usersByUnit);
    if (!atasan) {
      if (level !== 'other') unresolved += 1;
      else skipped += 1;
      continue;
    }
    if (norm(atasan.name) === norm(user.name)) {
      unresolved += 1;
      continue;
    }
    if (onlyEmpty && !empty) {
      skipped += 1;
      continue;
    }
    if (!empty && norm(current) === norm(atasan.name)) {
      skipped += 1;
      continue;
    }
    updates.push({
      id: user.id,
      npp: user.npp,
      name: user.name,
      unit_name: user.unit_name,
      jabatan: user.jabatan,
      level,
      expectedJabatan,
      viaParent,
      from: current || null,
      to: atasan.name,
      toJabatan: atasan.jabatan,
    });
  }

  return { updates, unresolved, skipped };
}

module.exports = {
  classifyUnit,
  matchesPemimpinLevel,
  levelLabel,
  resolveAtasan,
  planAtasanSync,
  buildUsersByUnit,
};
