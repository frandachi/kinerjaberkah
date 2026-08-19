/**
 * Master KPI (Model B): setiap konsep KPI punya kode (KPI-FIN-01, …).
 * Anak = baris pegawai/unit dengan nama yang sama; target & realisasi dijumlahkan ke parent.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

const PERSPECTIVE_PREFIX = {
  financial: 'FIN',
  customer: 'CUS',
  internal_process: 'IBP',
  learning_growth: 'LNG',
};

/** Kode yang dikunci (jangan digeser saat regenerate) */
const RESERVED_CODES = {
  'KPI-FIN-01': {
    groupKey: 'laba bersih',
    name: 'Laba Bersih (Konsolidasi)',
    perspective: 'financial',
  },
};

function parseJsonField(value, fallback = {}) {
  if (value == null || value === '') return { ...fallback };
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return { ...fallback };
  }
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeNameKey(name) {
  return String(name || '')
    .trim()
    .replace(/^-\s*/, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizePerspectiveKey(perspective) {
  const value = String(perspective || '').trim().toLowerCase();
  if (!value) return 'financial';
  if (value === 'financial' || value.includes('finansial')) return 'financial';
  if (value === 'customer' || value.includes('customer') || value.includes('pelanggan')) return 'customer';
  if (
    value === 'internal_process'
    || value.includes('internal')
    || value.includes('bisnis')
    || value.includes('proses')
    || value.includes('process')
  ) return 'internal_process';
  if (
    value === 'learning_growth'
    || value.includes('learning')
    || value.includes('growth')
    || value.includes('people')
  ) return 'learning_growth';
  return value;
}

/** Kunci grup: Laba Bersih* (non-pertumbuhan) digabung ke satu master */
function groupKeyForName(name) {
  const key = normalizeNameKey(name);
  if (!key) return '';
  if (key.includes('pertumbuhan') && key.includes('laba bersih')) return key;
  if (key === 'laba bersih' || key.startsWith('laba bersih')) return 'laba bersih';
  return key;
}

function isLabaBersihChildName(name) {
  return groupKeyForName(name) === 'laba bersih';
}

function padCode(n) {
  return String(n).padStart(2, '0');
}

function sumMonthlyMaps(rows, field) {
  const out = {};
  MONTHS.forEach((m) => {
    let sum = 0;
    let has = false;
    rows.forEach((row) => {
      const obj = parseJsonField(row[field]);
      const n = toNumber(obj?.[m]);
      if (n != null) {
        sum += n;
        has = true;
      }
    });
    if (has) out[m] = Math.round(sum * 1000) / 1000;
  });
  return out;
}

function sumNumericTargets(rows) {
  let sum = 0;
  let has = false;
  rows.forEach((row) => {
    const n = toNumber(row.target);
    if (n != null) {
      sum += n;
      has = true;
      return;
    }
    const mt = parseJsonField(row.monthly_target);
    const monthSum = MONTHS.reduce((acc, m) => {
      const v = toNumber(mt?.[m]);
      return acc + (v != null ? v : 0);
    }, 0);
    if (monthSum > 0) {
      sum += monthSum;
      has = true;
    }
  });
  return has ? Math.round(sum * 1000) / 1000 : 0;
}

function sumActuals(rows, monthlyDataSum) {
  const fromMonthly = MONTHS.reduce((acc, m) => acc + (toNumber(monthlyDataSum[m]) || 0), 0);
  if (fromMonthly > 0) return Math.round(fromMonthly * 1000) / 1000;

  let fromActual = 0;
  rows.forEach((row) => {
    const n = toNumber(row.actual);
    if (n != null) fromActual += n;
  });
  return Math.round(fromActual * 1000) / 1000;
}

async function ensureSchema(db) {
  const [cols] = await db.query('SHOW COLUMNS FROM kpis LIKE ?', ['kpi_code']);
  if (!cols.length) {
    await db.query(
      "ALTER TABLE kpis ADD COLUMN kpi_code VARCHAR(32) NULL COMMENT 'Kode master KPI, mis. KPI-FIN-01' AFTER id"
    );
    try {
      await db.query('CREATE INDEX idx_kpis_kpi_code ON kpis (kpi_code)');
    } catch { /* index may exist */ }
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS master_kpis (
      code VARCHAR(32) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      perspective VARCHAR(64) NOT NULL DEFAULT 'financial',
      unit VARCHAR(64) DEFAULT 'currency',
      polarity VARCHAR(32) DEFAULT 'maximize',
      description TEXT NULL,
      match_names JSON NULL,
      match_keys JSON NULL,
      parent_kpi_id VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [mkCols] = await db.query('SHOW COLUMNS FROM master_kpis LIKE ?', ['match_keys']);
  if (!mkCols.length) {
    await db.query('ALTER TABLE master_kpis ADD COLUMN match_keys JSON NULL AFTER match_names');
  }
}

async function loadCatalogFromDb(db) {
  const [rows] = await db.query('SELECT * FROM master_kpis ORDER BY code ASC');
  const byCode = {};
  const keyToCode = {};
  rows.forEach((row) => {
    const matchNames = parseJsonField(row.match_names, []);
    const matchKeys = parseJsonField(row.match_keys, []);
    const names = Array.isArray(matchNames) ? matchNames : [];
    const keys = Array.isArray(matchKeys) && matchKeys.length
      ? matchKeys
      : names.map((n) => groupKeyForName(n)).filter(Boolean);

    byCode[row.code] = {
      code: row.code,
      name: row.name,
      perspective: normalizePerspectiveKey(row.perspective),
      unit: row.unit || 'currency',
      polarity: row.polarity || 'maximize',
      description: row.description || '',
      matchNames: names,
      matchKeys: keys,
      weight: 0,
      objective: `Konsolidasi ${row.name}`,
    };
    keys.forEach((k) => {
      if (k) keyToCode[k] = row.code;
    });
  });
  return { byCode, keyToCode };
}

async function resolveMasterCodeForName(dbOrName, maybeName) {
  // Support legacy sync call: resolveMasterCodeForName(name) — needs DB async now
  if (typeof dbOrName === 'string' || maybeName === undefined) {
    const name = dbOrName;
    const key = groupKeyForName(name);
    if (key === 'laba bersih') return 'KPI-FIN-01';
    return null;
  }
  const db = dbOrName;
  const name = maybeName;
  const key = groupKeyForName(name);
  if (!key) return null;
  if (key === 'laba bersih') return 'KPI-FIN-01';

  const { keyToCode } = await loadCatalogFromDb(db);
  return keyToCode[key] || null;
}

async function ensureMasterParentRow(db, meta) {
  const code = meta.code;
  const [existing] = await db.query('SELECT id FROM kpis WHERE id = ?', [code]);
  if (!existing.length) {
    await db.query(
      `INSERT INTO kpis (
        id, kpi_code, name, perspective, unit, polarity, target, actual, weight,
        unit_name, jabatan, strategy_id, monthly_data, monthly_target, unit_type,
        parent_kpi_id, status, description, formula, objective, is_locked, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, NULL, ?, 1, 0)`,
      [
        code,
        code,
        meta.name,
        meta.perspective,
        meta.unit || 'currency',
        meta.polarity || 'maximize',
        0,
        0,
        0,
        'Bank SUMUT',
        'Konsolidasi Master',
        JSON.stringify({}),
        JSON.stringify({}),
        'master',
        'Approved',
        meta.description || `Master ${code}`,
        meta.objective || `Konsolidasi ${meta.name}`,
      ]
    );
  } else {
    await db.query(
      `UPDATE kpis SET
        kpi_code = ?, name = ?, perspective = ?, unit = ?, polarity = ?,
        unit_name = 'Bank SUMUT', jabatan = 'Konsolidasi Master', unit_type = 'master',
        description = ?, objective = ?, is_locked = 1, parent_kpi_id = NULL
       WHERE id = ?`,
      [
        code,
        meta.name,
        meta.perspective,
        meta.unit || 'currency',
        meta.polarity || 'maximize',
        meta.description || `Master ${code}`,
        meta.objective || `Konsolidasi ${meta.name}`,
        code,
      ]
    );
  }

  await db.query(
    `INSERT INTO master_kpis (code, name, perspective, unit, polarity, description, match_names, match_keys, parent_kpi_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       perspective = VALUES(perspective),
       unit = VALUES(unit),
       polarity = VALUES(polarity),
       description = VALUES(description),
       match_names = VALUES(match_names),
       match_keys = VALUES(match_keys),
       parent_kpi_id = VALUES(parent_kpi_id)`,
    [
      meta.code,
      meta.name,
      meta.perspective,
      meta.unit || 'currency',
      meta.polarity || 'maximize',
      meta.description || `Master ${code}`,
      JSON.stringify(meta.matchNames || []),
      JSON.stringify(meta.matchKeys || []),
      code,
    ]
  );

  return meta;
}

/**
 * Bangun katalog master dari semua nama KPI unik di DB.
 * KPI-FIN-01 tetap untuk grup Laba Bersih.
 */
async function buildMasterPlanFromDb(db) {
  const [rows] = await db.query(`
    SELECT name,
      MIN(perspective) AS perspective,
      MIN(unit) AS unit,
      MIN(polarity) AS polarity,
      COUNT(*) AS c
    FROM kpis
    WHERE COALESCE(unit_type, '') <> 'master'
    GROUP BY name
  `);

  /** @type {Map<string, { groupKey: string, perspective: string, names: Map<string, number>, unit: string, polarity: string, count: number }>} */
  const groups = new Map();

  rows.forEach((row) => {
    const gKey = groupKeyForName(row.name);
    if (!gKey) return;
    const perspective = normalizePerspectiveKey(row.perspective);
    const existing = groups.get(gKey);
    if (!existing) {
      groups.set(gKey, {
        groupKey: gKey,
        perspective,
        names: new Map([[row.name, Number(row.c) || 0]]),
        unit: row.unit || 'currency',
        polarity: row.polarity || 'maximize',
        count: Number(row.c) || 0,
      });
    } else {
      existing.names.set(row.name, (existing.names.get(row.name) || 0) + (Number(row.c) || 0));
      existing.count += Number(row.c) || 0;
      if (!existing.unit && row.unit) existing.unit = row.unit;
    }
  });

  const byPerspective = {
    financial: [],
    customer: [],
    internal_process: [],
    learning_growth: [],
  };

  groups.forEach((g) => {
    const bucket = byPerspective[g.perspective] || byPerspective.financial;
    // Prefer display name: reserved, or most frequent, or longest
    let displayName = [...g.names.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
    if (g.groupKey === 'laba bersih') {
      displayName = RESERVED_CODES['KPI-FIN-01'].name;
    }
    bucket.push({
      groupKey: g.groupKey,
      name: displayName,
      perspective: g.perspective,
      unit: g.unit || 'currency',
      polarity: g.polarity || 'maximize',
      matchNames: [...g.names.keys()],
      matchKeys: [g.groupKey],
      count: g.count,
    });
  });

  Object.values(byPerspective).forEach((list) => {
    list.sort((a, b) => {
      if (a.groupKey === 'laba bersih') return -1;
      if (b.groupKey === 'laba bersih') return 1;
      return a.name.localeCompare(b.name, 'id');
    });
  });

  const plan = [];
  const usedCodes = new Set();

  // Reserve FIN-01
  const finList = byPerspective.financial;
  const labaIdx = finList.findIndex((x) => x.groupKey === 'laba bersih');
  if (labaIdx >= 0) {
    const laba = finList.splice(labaIdx, 1)[0];
    plan.push({
      ...laba,
      code: 'KPI-FIN-01',
      description: 'Master KPI Laba Bersih — akumulasi seluruh unit/jabatan',
      objective: 'Meningkatkan Profitabilitas — Konsolidasi Bank SUMUT',
    });
    usedCodes.add('KPI-FIN-01');
  }

  for (const [persp, list] of Object.entries(byPerspective)) {
    const prefix = PERSPECTIVE_PREFIX[persp] || 'GEN';
    let n = persp === 'financial' ? 2 : 1;
    for (const item of list) {
      let code;
      do {
        code = `KPI-${prefix}-${padCode(n)}`;
        n += 1;
      } while (usedCodes.has(code));
      usedCodes.add(code);
      plan.push({
        ...item,
        code,
        description: `Master KPI ${item.name} (${code}) — akumulasi seluruh unit/jabatan`,
        objective: `Konsolidasi ${item.name}`,
      });
    }
  }

  return plan;
}

async function aggregateMasterFromChildren(db, code) {
  const [children] = await db.query(
    `SELECT id, name, target, actual, monthly_data, monthly_target, unit_name, jabatan
     FROM kpis
     WHERE (parent_kpi_id = ? OR kpi_code = ?) AND id <> ? AND COALESCE(unit_type, '') <> 'master'`,
    [code, code, code]
  );

  const monthly_data = sumMonthlyMaps(children, 'monthly_data');
  const monthly_target = sumMonthlyMaps(children, 'monthly_target');
  const target = sumNumericTargets(children);
  const actual = sumActuals(children, monthly_data);

  await db.query(
    `UPDATE kpis SET
      target = ?, actual = ?,
      monthly_data = ?, monthly_target = ?,
      updated_by = 'system:master-aggregate'
     WHERE id = ?`,
    [
      String(target),
      actual,
      JSON.stringify(monthly_data),
      JSON.stringify(monthly_target),
      code,
    ]
  );

  return {
    code,
    childCount: children.length,
    target,
    actual,
    monthly_data,
    monthly_target,
  };
}

async function linkChildrenByPlan(db, plan) {
  const keyToCode = {};
  plan.forEach((p) => {
    (p.matchKeys || []).forEach((k) => { keyToCode[k] = p.code; });
    (p.matchNames || []).forEach((n) => { keyToCode[groupKeyForName(n)] = p.code; });
  });

  const [all] = await db.query(
    `SELECT id, name FROM kpis WHERE COALESCE(unit_type, '') <> 'master'`
  );

  let linked = 0;
  for (const row of all) {
    const code = keyToCode[groupKeyForName(row.name)];
    if (!code) continue;
    await db.query(
      'UPDATE kpis SET parent_kpi_id = ?, kpi_code = ? WHERE id = ?',
      [code, code, row.id]
    );
    linked += 1;
  }
  return { linked, masters: plan.length };
}

/**
 * Setup semua master KPI dari nama unik di DB + agregasi.
 */
async function setupAllMasterKpis(db) {
  await ensureSchema(db);
  const plan = await buildMasterPlanFromDb(db);

  for (const meta of plan) {
    await ensureMasterParentRow(db, meta);
  }

  const link = await linkChildrenByPlan(db, plan);
  const aggregates = [];
  for (const meta of plan) {
    aggregates.push(await aggregateMasterFromChildren(db, meta.code));
  }

  return {
    masters: plan.length,
    linked: link.linked,
    aggregates: aggregates.map((a) => ({
      code: a.code,
      childCount: a.childCount,
      target: a.target,
      actual: a.actual,
    })),
  };
}

async function setupMasterKpiFin01(db) {
  // backward-compatible: full setup
  return setupAllMasterKpis(db);
}

async function listMasterKpis(db, { perspective } = {}) {
  await ensureSchema(db);
  let sql = `
    SELECT m.code, m.name, m.perspective, m.unit, m.polarity, m.description, m.match_names, m.match_keys,
           k.target, k.actual, k.monthly_data, k.monthly_target,
           (
             SELECT COUNT(*) FROM kpis c
             WHERE (c.parent_kpi_id = m.code OR c.kpi_code = m.code)
               AND c.id <> m.code
               AND COALESCE(c.unit_type, '') <> 'master'
           ) AS childCount
    FROM master_kpis m
    LEFT JOIN kpis k ON k.id = m.parent_kpi_id
  `;
  const params = [];
  if (perspective && perspective !== 'all') {
    sql += ' WHERE m.perspective = ?';
    params.push(normalizePerspectiveKey(perspective));
  }
  sql += ' ORDER BY m.perspective ASC, m.code ASC';

  const [rows] = await db.query(sql, params);

  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    perspective: normalizePerspectiveKey(row.perspective),
    unit: row.unit,
    polarity: row.polarity,
    description: row.description,
    matchNames: parseJsonField(row.match_names, []),
    matchKeys: parseJsonField(row.match_keys, []),
    target: toNumber(row.target) ?? row.target,
    actual: toNumber(row.actual) ?? 0,
    monthly_data: parseJsonField(row.monthly_data),
    monthly_target: parseJsonField(row.monthly_target),
    childCount: Number(row.childCount) || 0,
  }));
}

async function getMasterDetail(db, code) {
  const [parents] = await db.query('SELECT * FROM kpis WHERE id = ?', [code]);
  if (!parents.length) return null;

  const [metaRows] = await db.query('SELECT * FROM master_kpis WHERE code = ?', [code]);
  const parent = parents[0];
  const [children] = await db.query(
    `SELECT id, name, unit_name, jabatan, target, actual, weight, unit, polarity, perspective,
            monthly_data, monthly_target, kpi_code, parent_kpi_id
     FROM kpis
     WHERE (parent_kpi_id = ? OR kpi_code = ?) AND id <> ? AND COALESCE(unit_type, '') <> 'master'
     ORDER BY unit_name ASC, jabatan ASC, name ASC`,
    [code, code, code]
  );

  return {
    code,
    meta: metaRows[0]
      ? {
        code: metaRows[0].code,
        name: metaRows[0].name,
        perspective: normalizePerspectiveKey(metaRows[0].perspective),
        unit: metaRows[0].unit,
        polarity: metaRows[0].polarity,
        description: metaRows[0].description,
        matchNames: parseJsonField(metaRows[0].match_names, []),
        matchKeys: parseJsonField(metaRows[0].match_keys, []),
      }
      : { code, name: parent.name },
    parent: {
      ...parent,
      monthly_data: parseJsonField(parent.monthly_data),
      monthly_target: parseJsonField(parent.monthly_target),
    },
    childCount: children.length,
    children: children.map((c) => ({
      ...c,
      monthly_data: parseJsonField(c.monthly_data),
      monthly_target: parseJsonField(c.monthly_target),
    })),
  };
}

/**
 * Setelah create/update anak: set kode+parent dari katalog DB, lalu re-agregasi.
 */
async function syncChildMasterLink(db, kpiRow) {
  if (!kpiRow || !kpiRow.id) return null;
  if (String(kpiRow.id).startsWith('KPI-') || kpiRow.unit_type === 'master') return null;

  const code = await resolveMasterCodeForName(db, kpiRow.name);
  if (code) {
    await db.query(
      'UPDATE kpis SET parent_kpi_id = ?, kpi_code = ? WHERE id = ?',
      [code, code, kpiRow.id]
    );
    return aggregateMasterFromChildren(db, code);
  }

  if (kpiRow.kpi_code || kpiRow.parent_kpi_id) {
    const prev = kpiRow.kpi_code || kpiRow.parent_kpi_id;
    await db.query(
      'UPDATE kpis SET parent_kpi_id = NULL, kpi_code = NULL WHERE id = ?',
      [kpiRow.id]
    );
    if (prev) return aggregateMasterFromChildren(db, prev);
  }
  return null;
}

async function reaggregateIfChildOrMaster(db, kpiId) {
  if (!kpiId) return null;
  if (String(kpiId).startsWith('KPI-')) {
    return aggregateMasterFromChildren(db, kpiId);
  }
  const [rows] = await db.query(
    'SELECT id, name, kpi_code, parent_kpi_id, unit_type FROM kpis WHERE id = ?',
    [kpiId]
  );
  if (!rows.length) return null;
  const row = rows[0];
  if (row.kpi_code) return aggregateMasterFromChildren(db, row.kpi_code);
  if (row.parent_kpi_id) return aggregateMasterFromChildren(db, row.parent_kpi_id);
  return syncChildMasterLink(db, row);
}

/** @deprecated static catalog — gunakan loadCatalogFromDb */
const MASTER_KPI_CATALOG = {
  'KPI-FIN-01': RESERVED_CODES['KPI-FIN-01'],
};

module.exports = {
  MONTHS,
  MASTER_KPI_CATALOG,
  RESERVED_CODES,
  isLabaBersihChildName,
  groupKeyForName,
  normalizeNameKey,
  normalizePerspectiveKey,
  resolveMasterCodeForName,
  ensureSchema,
  ensureMasterParentRow,
  buildMasterPlanFromDb,
  linkChildrenByPlan,
  aggregateMasterFromChildren,
  setupMasterKpiFin01,
  setupAllMasterKpis,
  listMasterKpis,
  getMasterDetail,
  syncChildMasterLink,
  reaggregateIfChildOrMaster,
  loadCatalogFromDb,
  parseJsonField,
};
