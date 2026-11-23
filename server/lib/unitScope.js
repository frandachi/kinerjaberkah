const unitInduk = require('./unit-induk.json');
const unitAliases = require('./unit-aliases.json');

function normUnit(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Compact key sama seperti frontend normUnitKey (nU). */
function compactKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Canonical compact key setelah alias map. */
function canonicalKey(s) {
  const k = compactKey(s);
  if (!k) return '';
  return unitAliases[k] || k;
}

function keysMatch(a, b) {
  const ka = canonicalKey(a);
  const kb = canonicalKey(b);
  return !!ka && ka === kb;
}

function isUnrestrictedRole(role) {
  return role === 'superadmin';
}

/**
 * Variasi ejaan umum agar SQL IN tidak miss
 * (Commercial↔Comercial, Over↔over, dll via alias).
 */
function variantNames(unitName) {
  const self = String(unitName || '').trim();
  if (!self) return [];
  const out = new Set([self]);
  out.add(self.replace(/Commercial/g, 'Comercial').replace(/commercial/g, 'comercial'));
  out.add(self.replace(/Comercial/g, 'Commercial').replace(/comercial/g, 'commercial'));
  out.add(self.replace(/ Over /g, ' over ').replace(/ over /g, ' Over '));
  // jika ada nama master yang canonical-nya sama di unit-induk keys
  const canon = canonicalKey(self);
  for (const child of Object.keys(unitInduk || {})) {
    if (canonicalKey(child) === canon) out.add(child);
  }
  for (const parent of Object.values(unitInduk || {})) {
    if (canonicalKey(parent) === canon) out.add(String(parent).trim());
  }
  return [...out].filter(Boolean);
}

function childUnitsOf(unitName) {
  const parent = String(unitName || '').trim();
  if (!parent) return [];
  const parentCanon = canonicalKey(parent);
  const children = [];
  for (const [child, p] of Object.entries(unitInduk || {})) {
    if (keysMatch(p, parent) || canonicalKey(p) === parentCanon) {
      children.push(child);
    }
  }
  return children;
}

function descendantUnitsOf(unitName) {
  const out = [];
  const seen = new Set();
  const queue = [...childUnitsOf(unitName)];
  while (queue.length) {
    const u = queue.shift();
    const key = canonicalKey(u) || normUnit(u);
    if (!u || seen.has(key)) continue;
    seen.add(key);
    out.push(u);
    queue.push(...childUnitsOf(u));
  }
  return out;
}

/** Unit sendiri + anak + variasi ejaan (untuk SQL/filter). */
function scopedUnitNames(unitName) {
  const self = String(unitName || '').trim();
  if (!self) return [];
  const seen = new Set();
  const list = [];
  const add = (name) => {
    for (const v of variantNames(name)) {
      const key = canonicalKey(v) + '||' + normUnit(v);
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(v);
    }
  };
  add(self);
  for (const child of descendantUnitsOf(self)) add(child);
  return list;
}

function unitInScope(unitName, scopedUnits) {
  if (!scopedUnits || !scopedUnits.length) return false;
  return scopedUnits.some((u) => keysMatch(unitName, u));
}

function attachUnitScope(user) {
  if (!user) return user;
  if (isUnrestrictedRole(user.role)) {
    user.unit_scope_unrestricted = true;
    user.scoped_units = null;
  } else {
    user.unit_scope_unrestricted = false;
    user.scoped_units = scopedUnitNames(user.unit_name);
  }
  return user;
}

/**
 * Resolve scoped unit list for request user (refresh unit_name from DB when possible).
 * Returns { unrestricted, units }.
 */
async function resolveUnitScope(db, user) {
  if (!user) return { unrestricted: false, units: [] };
  if (isUnrestrictedRole(user.role)) return { unrestricted: true, units: null };

  let unitName = user.unit_name || '';
  try {
    const [rows] = await db.query(
      'SELECT unit_name, role FROM users WHERE id = ? LIMIT 1',
      [user.id]
    );
    if (rows[0]) {
      unitName = rows[0].unit_name || unitName;
      if (isUnrestrictedRole(rows[0].role)) {
        return { unrestricted: true, units: null };
      }
    }
  } catch (_) {
    /* ignore */
  }

  let units = scopedUnitNames(unitName);

  // Perluas dari ejaan yang benar-benar ada di DB (kpis + pegawai)
  try {
    const canonSet = new Set(units.map(canonicalKey).filter(Boolean));
    if (canonSet.size) {
      const [kpiUnits] = await db.query(
        `SELECT DISTINCT unit_name FROM kpis
         WHERE unit_name IS NOT NULL AND TRIM(unit_name) <> ''`
      );
      const [pegUnits] = await db.query(
        `SELECT DISTINCT unit_name FROM pegawai
         WHERE unit_name IS NOT NULL AND TRIM(unit_name) <> ''`
      );
      const seen = new Set(units.map((u) => normUnit(u)));
      for (const row of [...(kpiUnits || []), ...(pegUnits || [])]) {
        const name = String(row.unit_name || '').trim();
        if (!name) continue;
        if (!canonSet.has(canonicalKey(name))) continue;
        const key = normUnit(name);
        if (seen.has(key)) continue;
        seen.add(key);
        units.push(name);
      }
    }
  } catch (_) {
    /* ignore expansion errors */
  }

  return { unrestricted: false, units };
}

function sqlInPlaceholders(count) {
  return Array.from({ length: count }, () => '?').join(',');
}

module.exports = {
  normUnit,
  compactKey,
  canonicalKey,
  keysMatch,
  variantNames,
  isUnrestrictedRole,
  childUnitsOf,
  descendantUnitsOf,
  scopedUnitNames,
  unitInScope,
  attachUnitScope,
  resolveUnitScope,
  sqlInPlaceholders,
};
