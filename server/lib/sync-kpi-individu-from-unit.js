/**
 * Reset KPI Individu pemimpin agar identik dengan KPI Unit Kerja.
 * Sumber: from-nilai-kantor-cabang (prioritas) → from-individu-pemimpin → KPI unit lain.
 * Target: hapus KPI individu kepala di unit tsb, lalu isi ulang dari Unit.
 */
const {
  PIC: PIC_UNIT_SYNC,
  orgOfUnit,
  isHead,
  isUnitKantorOrg,
  canonUnit,
  unitNameNorms,
  unitTypeOfOrg,
} = require('./sync-kpi-unit-from-pemimpin');

const PIC_EXCEL = 'from-nilai-kantor-cabang';

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^pj\.?\s*/i, '')
    .replace(/[.,;]+$/g, '');
}

function jsonText(v) {
  if (v == null || v === '') return '{}';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function pickUnitRows(rows) {
  if (!rows.length) return [];
  const excel = rows.filter((r) => r.pic === PIC_EXCEL);
  if (excel.length) return excel;
  const sync = rows.filter((r) => r.pic === PIC_UNIT_SYNC);
  if (sync.length) return sync;
  return rows;
}

function copyToIndividu(unitKpi, head, id) {
  return {
    id,
    name: unitKpi.name,
    perspective: unitKpi.perspective,
    unit: unitKpi.unit,
    polarity: unitKpi.polarity,
    target: unitKpi.target,
    actual: unitKpi.actual,
    weight: unitKpi.weight,
    unit_name: head.unitCanon,
    jabatan: head.jabatan,
    strategy_id: unitKpi.strategy_id || null,
    monthly_data: jsonText(unitKpi.monthly_data),
    monthly_target: jsonText(unitKpi.monthly_target),
    unit_type: 'pegawai',
    status: unitKpi.status || 'Draft',
    description: unitKpi.description || null,
    formula: unitKpi.formula || null,
    objective: unitKpi.objective || null,
    sort_order: unitKpi.sort_order || 0,
    manual_indeks: unitKpi.manual_indeks,
    pic: head.name || null,
    kpi_code: unitKpi.kpi_code || null,
    parent_kpi_id: null,
  };
}

async function syncKpiIndividuFromUnit(db) {
  const [cols] = await db.query('SHOW COLUMNS FROM kpis');
  const colSet = new Set(cols.map((c) => c.Field));

  const [pegawai] = await db.query('SELECT name, jabatan, unit_name FROM pegawai');
  const headsByUnit = new Map();
  for (const p of pegawai) {
    const org = orgOfUnit(p.unit_name);
    if (!org || !isHead(org, p.jabatan)) continue;
    const unitCanon = canonUnit(p.unit_name);
    const key = norm(unitCanon);
    const cand = { ...p, org, unitCanon, unitType: unitTypeOfOrg(org) };
    const prev = headsByUnit.get(key);
    if (!prev) {
      headsByUnit.set(key, cand);
      continue;
    }
    // Non-Pj lebih disukai jika keduanya kepala
    if (/^pj\.?/i.test(prev.jabatan) && !/^pj\.?/i.test(cand.jabatan)) {
      headsByUnit.set(key, cand);
    }
  }

  const [unitRows] = await db.query(
    `SELECT * FROM kpis
     WHERE COALESCE(unit_type,'') NOT IN ('','master','pegawai')
     ORDER BY unit_name, sort_order, name`
  );
  const byUnit = new Map();
  for (const r of unitRows) {
    const key = norm(canonUnit(r.unit_name));
    if (!byUnit.has(key)) byUnit.set(key, []);
    byUnit.get(key).push(r);
  }

  let deleted = 0;
  let inserted = 0;
  const units = [];
  const skipped = [];
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    let n = 0;

    for (const [unitKey, rows] of byUnit.entries()) {
      const src = pickUnitRows(rows);
      if (!src.length) continue;
      const sample = src[0];
      const org = orgOfUnit(sample.unit_name) || sample.unit_type;
      const head = headsByUnit.get(unitKey);
      if (!head) {
        skipped.push({
          unit_name: sample.unit_name,
          unit_type: sample.unit_type,
          reason: 'tidak ada pemimpin di pegawai',
          kpi: src.length,
        });
        continue;
      }

      const unitNorms = unitNameNorms(head.unit_name);
      // Hapus semua KPI individu kepala di unit ini (semua ejaan jabatan kepala)
      const [jabRows] = await conn.query(
        `SELECT DISTINCT jabatan FROM kpis
         WHERE COALESCE(unit_type,'') = 'pegawai'
           AND LOWER(TRIM(unit_name)) IN (?)`,
        [unitNorms]
      );
      const headJabs = jabRows.map((r) => r.jabatan).filter((j) => isHead(org, j));
      // Juga hapus jabatan pegawai kepala meski belum ada KPI
      if (!headJabs.includes(head.jabatan)) headJabs.push(head.jabatan);

      if (headJabs.length) {
        const [del] = await conn.query(
          `DELETE FROM kpis
           WHERE COALESCE(unit_type,'') = 'pegawai'
             AND LOWER(TRIM(unit_name)) IN (?)
             AND jabatan IN (?)`,
          [unitNorms, headJabs]
        );
        deleted += del.affectedRows || 0;
      }

      const values = src.map((k) => {
        const id = `kpi_${Date.now()}_${n}_${Math.floor(Math.random() * 1e6)}`;
        n += 1;
        return copyToIndividu(k, head, id);
      });
      const fields = Object.keys(values[0]).filter((f) => colSet.has(f));
      await conn.query(`INSERT INTO kpis (${fields.join(',')}) VALUES ?`, [
        values.map((row) => fields.map((f) => row[f])),
      ]);
      inserted += values.length;
      units.push({
        unit_name: head.unitCanon,
        unit_type: head.unitType,
        jabatan: head.jabatan,
        pemimpin: head.name,
        source_pic: src[0].pic || '(null)',
        kpi: values.length,
      });
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return {
    deleted,
    inserted,
    unitCount: units.length,
    heads: headsByUnit.size,
    units,
    skipped,
  };
}

module.exports = {
  syncKpiIndividuFromUnit,
  PIC_EXCEL,
};
