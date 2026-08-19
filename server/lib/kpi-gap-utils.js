const LEVEL_ORDER = ['corporate', 'divisi', 'kck', 'kc', 'kcp'];

function inferLevelUnit(unitName) {
  if (!unitName) return 'divisi';
  const name = unitName.toUpperCase();
  if (name.includes('KOORDINATOR') || name.includes('KORDINATOR')) return 'kck';
  if (name.includes('CABANG PEMBANTU') || name.includes('CAPEM')) return 'kcp';
  if (name.startsWith('CABANG ') || name.includes('KANTOR CABANG') || name.includes('CABANG SYARIAH')) return 'kc';
  if (name.includes('DIREKTUR') || name.includes('DIREKSI')) return 'corporate';
  return 'divisi';
}

async function getGapSummary(db) {
  const [noKpiRows] = await db.query(`
    SELECT level_unit, COUNT(*) AS count, SUM(jumlah_pegawai) AS pegawai
    FROM (
      SELECT u.unit_name, u.jabatan, COUNT(*) AS jumlah_pegawai,
        CASE
          WHEN UPPER(u.unit_name) LIKE '%KOORDINATOR%' OR UPPER(u.unit_name) LIKE '%KORDINATOR%' THEN 'kck'
          WHEN UPPER(u.unit_name) LIKE '%CABANG PEMBANTU%' OR UPPER(u.unit_name) LIKE '%CAPEM%' THEN 'kcp'
          WHEN UPPER(u.unit_name) LIKE 'CABANG %' OR UPPER(u.unit_name) LIKE '%KANTOR CABANG%' OR UPPER(u.unit_name) LIKE '%CABANG SYARIAH%' THEN 'kc'
          WHEN UPPER(u.unit_name) LIKE '%DIREKTUR%' OR UPPER(u.unit_name) LIKE '%DIREKSI%' THEN 'corporate'
          ELSE 'divisi'
        END AS level_unit
      FROM users u
      LEFT JOIN kpis k ON k.jabatan = u.jabatan AND k.unit_name = u.unit_name
      WHERE u.role != 'superadmin'
        AND u.jabatan IS NOT NULL AND u.jabatan != '' AND u.jabatan != '-'
        AND u.unit_name IS NOT NULL AND u.unit_name != ''
        AND k.id IS NULL
      GROUP BY u.unit_name, u.jabatan, level_unit
    ) t
    GROUP BY level_unit
  `);

  const [emptyTargetRows] = await db.query(`
    SELECT level_unit, COUNT(*) AS count
    FROM (
      SELECT DISTINCT jabatan, unit_name,
        CASE
          WHEN UPPER(unit_name) LIKE '%KOORDINATOR%' OR UPPER(unit_name) LIKE '%KORDINATOR%' THEN 'kck'
          WHEN UPPER(unit_name) LIKE '%CABANG PEMBANTU%' OR UPPER(unit_name) LIKE '%CAPEM%' THEN 'kcp'
          WHEN UPPER(unit_name) LIKE 'CABANG %' OR UPPER(unit_name) LIKE '%KANTOR CABANG%' OR UPPER(unit_name) LIKE '%CABANG SYARIAH%' THEN 'kc'
          WHEN UPPER(unit_name) LIKE '%DIREKTUR%' OR UPPER(unit_name) LIKE '%DIREKSI%' THEN 'corporate'
          ELSE 'divisi'
        END AS level_unit
      FROM kpis
      WHERE jabatan IS NOT NULL AND jabatan != ''
        AND (target IS NULL OR TRIM(target) = '' OR target = '0')
    ) t
    GROUP BY level_unit
  `);

  const noKpi = { total: 0, pegawai: 0, byLevel: {} };
  for (const row of noKpiRows) {
    noKpi.byLevel[row.level_unit] = { count: Number(row.count), pegawai: Number(row.pegawai) };
    noKpi.total += Number(row.count);
    noKpi.pegawai += Number(row.pegawai);
  }

  const emptyTarget = { total: 0, byLevel: {} };
  for (const row of emptyTargetRows) {
    emptyTarget.byLevel[row.level_unit] = Number(row.count);
    emptyTarget.total += Number(row.count);
  }

  const [noKpiPegawaiRows] = await db.query(`
    SELECT COUNT(*) AS total
    FROM pegawai p
    LEFT JOIN kpis k ON k.jabatan = p.jabatan AND k.unit_name = p.unit_name
    WHERE p.jabatan IS NOT NULL AND TRIM(p.jabatan) != '' AND p.jabatan != '-'
      AND p.unit_name IS NOT NULL AND TRIM(p.unit_name) != '' AND p.unit_name != '-'
      AND p.name IS NOT NULL AND TRIM(p.name) != '' AND p.name != '-'
      AND p.id != 'admin_0'
      AND k.id IS NULL
  `);
  const noKpiPegawai = Number(noKpiPegawaiRows[0]?.total ?? 0);

  return { noKpi, emptyTarget, noKpiPegawai, levelOrder: LEVEL_ORDER };
}

async function getGapList(db, { type = 'no_kpi', level = 'all', search = '' } = {}) {
  if (type === 'no_kpi_pegawai') {
    let query = `
      SELECT pegawai_id, name, npp, jabatan, unit_name, level_unit
      FROM (
        SELECT p.id AS pegawai_id, p.name, p.npp, p.jabatan, p.unit_name,
          CASE
            WHEN UPPER(p.unit_name) LIKE '%KOORDINATOR%' OR UPPER(p.unit_name) LIKE '%KORDINATOR%' THEN 'kck'
            WHEN UPPER(p.unit_name) LIKE '%CABANG PEMBANTU%' OR UPPER(p.unit_name) LIKE '%CAPEM%' THEN 'kcp'
            WHEN UPPER(p.unit_name) LIKE 'CABANG %' OR UPPER(p.unit_name) LIKE '%KANTOR CABANG%' OR UPPER(p.unit_name) LIKE '%CABANG SYARIAH%' THEN 'kc'
            WHEN UPPER(p.unit_name) LIKE '%DIREKTUR%' OR UPPER(p.unit_name) LIKE '%DIREKSI%' THEN 'corporate'
            ELSE 'divisi'
          END AS level_unit
        FROM pegawai p
        LEFT JOIN kpis k ON k.jabatan = p.jabatan AND k.unit_name = p.unit_name
        WHERE p.jabatan IS NOT NULL AND TRIM(p.jabatan) != '' AND p.jabatan != '-'
          AND p.unit_name IS NOT NULL AND TRIM(p.unit_name) != '' AND p.unit_name != '-'
          AND p.name IS NOT NULL AND TRIM(p.name) != '' AND p.name != '-'
          AND p.id != 'admin_0'
          AND k.id IS NULL
      ) t WHERE 1=1
    `;
    const params = [];
    if (level && level !== 'all') { query += ' AND level_unit = ?'; params.push(level); }
    if (search) {
      query += ' AND (name LIKE ? OR npp LIKE ? OR unit_name LIKE ? OR jabatan LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY level_unit, unit_name, jabatan, name';
    const [rows] = await db.query(query, params);
    return rows.map((r) => ({
      pegawai_id: r.pegawai_id,
      name: r.name,
      npp: r.npp,
      unit_name: r.unit_name,
      jabatan: r.jabatan,
      level_unit: r.level_unit,
      jumlah_pegawai: 1,
      kpi_count: 0,
      gap_type: 'no_kpi_pegawai',
    }));
  }

  if (type === 'empty_target') {
    let query = `
      SELECT unit_name, jabatan, kpi_count, level_unit
      FROM (
        SELECT unit_name, jabatan, COUNT(*) AS kpi_count,
          CASE
            WHEN UPPER(unit_name) LIKE '%KOORDINATOR%' OR UPPER(unit_name) LIKE '%KORDINATOR%' THEN 'kck'
            WHEN UPPER(unit_name) LIKE '%CABANG PEMBANTU%' OR UPPER(unit_name) LIKE '%CAPEM%' THEN 'kcp'
            WHEN UPPER(unit_name) LIKE 'CABANG %' OR UPPER(unit_name) LIKE '%KANTOR CABANG%' OR UPPER(unit_name) LIKE '%CABANG SYARIAH%' THEN 'kc'
            WHEN UPPER(unit_name) LIKE '%DIREKTUR%' OR UPPER(unit_name) LIKE '%DIREKSI%' THEN 'corporate'
            ELSE 'divisi'
          END AS level_unit
        FROM kpis
        WHERE jabatan IS NOT NULL AND jabatan != ''
          AND (target IS NULL OR TRIM(target) = '' OR target = '0')
        GROUP BY unit_name, jabatan, level_unit
      ) t WHERE 1=1
    `;
    const params = [];
    if (level && level !== 'all') { query += ' AND level_unit = ?'; params.push(level); }
    if (search) { query += ' AND (unit_name LIKE ? OR jabatan LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    query += ' ORDER BY level_unit, unit_name, jabatan';
    const [rows] = await db.query(query, params);
    return rows.map(r => ({
      unit_name: r.unit_name, jabatan: r.jabatan, level_unit: r.level_unit,
      jumlah_pegawai: 0, kpi_count: Number(r.kpi_count), gap_type: 'empty_target',
    }));
  }

  let query = `
    SELECT unit_name, jabatan, jumlah_pegawai, level_unit
    FROM (
      SELECT u.unit_name, u.jabatan, COUNT(*) AS jumlah_pegawai,
        CASE
          WHEN UPPER(u.unit_name) LIKE '%KOORDINATOR%' OR UPPER(u.unit_name) LIKE '%KORDINATOR%' THEN 'kck'
          WHEN UPPER(u.unit_name) LIKE '%CABANG PEMBANTU%' OR UPPER(u.unit_name) LIKE '%CAPEM%' THEN 'kcp'
          WHEN UPPER(u.unit_name) LIKE 'CABANG %' OR UPPER(u.unit_name) LIKE '%KANTOR CABANG%' OR UPPER(u.unit_name) LIKE '%CABANG SYARIAH%' THEN 'kc'
          WHEN UPPER(u.unit_name) LIKE '%DIREKTUR%' OR UPPER(u.unit_name) LIKE '%DIREKSI%' THEN 'corporate'
          ELSE 'divisi'
        END AS level_unit
      FROM users u
      LEFT JOIN kpis k ON k.jabatan = u.jabatan AND k.unit_name = u.unit_name
      WHERE u.role != 'superadmin'
        AND u.jabatan IS NOT NULL AND u.jabatan != '' AND u.jabatan != '-'
        AND u.unit_name IS NOT NULL AND u.unit_name != ''
        AND k.id IS NULL
      GROUP BY u.unit_name, u.jabatan, level_unit
    ) t WHERE 1=1
  `;
  const params = [];
  if (level && level !== 'all') { query += ' AND level_unit = ?'; params.push(level); }
  if (search) { query += ' AND (unit_name LIKE ? OR jabatan LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  query += ' ORDER BY level_unit, unit_name, jabatan';
  const [rows] = await db.query(query, params);
  return rows.map(r => ({
    unit_name: r.unit_name, jabatan: r.jabatan, level_unit: r.level_unit,
    jumlah_pegawai: Number(r.jumlah_pegawai), kpi_count: 0, gap_type: 'no_kpi',
  }));
}

module.exports = { inferLevelUnit, getGapSummary, getGapList, LEVEL_ORDER };
