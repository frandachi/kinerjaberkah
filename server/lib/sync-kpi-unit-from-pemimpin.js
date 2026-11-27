/**
 * Salin KPI Individu pemimpin menjadi KPI Unit (satuan/bobot/target/bulanan identik).
 * Cakupan: Divisi, Departemen, UKK, Unit, Cabang (KCK/KC/KCP), Project.
 * Unit kantor: hapus KPI Unit upload lama di unit yang tersinkron.
 * Idempotent: hapus pic=from-individu-pemimpin lalu isi ulang.
 */
const PIC = 'from-individu-pemimpin';

const CANON = {
  'departemen pelindungan konsumen': 'Departemen Perlindungan Konsumen',
  'departemen perlindungan konsumen': 'Departemen Perlindungan Konsumen',
  'ukk commercial business center': 'UKK Commercial Business Center',
  'ukk comercial business center': 'UKK Commercial Business Center',
  'ukk internal control over financial report': 'UKK Internal Control Over Financial Report',
  'unit keamanan & ketahanan siber': 'Unit Keamanan dan Ketahan Siber',
  'unit keamanan dan ketahanan siber': 'Unit Keamanan dan Ketahan Siber',
  'unit keamanan dan ketahan siber': 'Unit Keamanan dan Ketahan Siber',
  'cabang pembantu mal pelayanan publik kabupaten simalungun': 'Cabang Pembantu MPP Kabupaten Simalungun',
  'cabang pembantu mpp simalungun': 'Cabang Pembantu MPP Kabupaten Simalungun',
  'cabang pembantu mal pelayanan publik kabupaten asahan': 'Cabang Pembantu MPP Kabupaten Asahan',
  'cabang pembantu mal pelayanan publik kabupaten batubara': 'Cabang Pembantu MPP Kabupaten Batubara',
  'cabang pembantu mal pelayanan publik kabupaten humbang hasundutan': 'Cabang Pembantu MPP Kabupaten Humbahas',
  'cabang pembantu mal pelayanan publik humbahas': 'Cabang Pembantu MPP Kabupaten Humbahas',
  'cabang pembantu mal pelayanan publik kabupaten labuhan batu utara': 'Cabang Pembantu MPP Kabupaten Labuhan Batu Utara',
  'cabang pembantu mal pelayanan publik tebing tinggi': 'Cabang Pembantu MPP Kota Tebing Tinggi',
  'cabang pembantu mal pelayanan publik kota tebing tinggi': 'Cabang Pembantu MPP Kota Tebing Tinggi',
  'cabang pembantu mal pelayanan publik kota medan': 'Cabang Pembantu MPP Kota Medan',
  'cabang pembantu mal pelayanan publik kota pematang siantar': 'Cabang Pembantu MPP Kota Pematang Siantar',
  'cabang pembantu mal pelayanan publik pematang siantar': 'Cabang Pembantu MPP Kota Pematang Siantar',
};

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^pj\.?\s*/i, '')
    .replace(/[.,;]+$/g, '');
}

function canonUnit(name) {
  const n = norm(name);
  return CANON[n] || String(name || '').trim();
}

/** Semua ejaan unit_name yang perlu dicoba saat lookup Individu. */
function unitNameNorms(name) {
  const raw = String(name || '').trim();
  const c = canonUnit(raw);
  const norms = new Set([norm(raw), norm(c)]);
  for (const [k, v] of Object.entries(CANON)) {
    if (norms.has(k) || norms.has(norm(v))) {
      norms.add(k);
      norms.add(norm(v));
    }
  }
  return [...norms].filter(Boolean);
}

function orgOfUnit(name) {
  const u = String(name || '').trim();
  if (/^divisi\b/i.test(u)) return 'divisi';
  if (/^departemen/i.test(u)) return 'departemen';
  if (/^ukk\b/i.test(u)) return 'ukk';
  if (/^unit\b/i.test(u)) return 'unit';
  if (/^project\b/i.test(u) || /^proyek\b/i.test(u)) return 'project';
  if (/^cabang pembantu\b/i.test(u) || /^capem\b/i.test(u)) return 'kcp';
  if (/^cabang utama\b/i.test(u) || /^cabang koordinator\b/i.test(u) || /^kck\b/i.test(u)) return 'kck';
  if (/^cabang\b/i.test(u)) return 'kc';
  return null;
}

function unitTypeOfOrg(org) {
  if (org === 'divisi') return 'divisi';
  if (org === 'departemen') return 'departemen';
  if (org === 'ukk') return 'ukk';
  if (org === 'unit') return 'unit';
  if (org === 'project') return 'project';
  if (org === 'kck') return 'kck';
  if (org === 'kc') return 'kc';
  if (org === 'kcp') return 'kcp';
  return 'divisi';
}

function isUnitKantorOrg(org) {
  return org === 'kck' || org === 'kc' || org === 'kcp';
}

function isHead(org, jabatan) {
  const j = norm(jabatan);
  if (!j || j.includes('wakil')) return false;
  if (
    j.includes('seksi') ||
    j.includes('kas mobil') ||
    j.includes('payment point') ||
    j.includes('pemimpin payment') ||
    j.includes('unit layanan') ||
    j.includes('operasional')
  ) {
    return false;
  }
  if (org === 'divisi') return /^pemimpin divisi\b/.test(j) || /^kepala divisi\b/.test(j);
  if (org === 'departemen') return /^pemimpin departemen\b/.test(j) || /^kepala departemen\b/.test(j);
  if (org === 'ukk') return /^pemimpin ukk\b/.test(j) || /^kepala ukk\b/.test(j);
  if (org === 'unit') return /^pemimpin unit\b/.test(j) || /^kepala unit\b/.test(j);
  if (org === 'project') {
    return (
      /^pemimpin (project|proyek)\b/.test(j) ||
      /^project leader\b/.test(j) ||
      /^pemimpin project team\b/.test(j)
    );
  }
  if (isUnitKantorOrg(org)) {
    return (
      /^pemimpin cabang\b/.test(j) ||
      /^pemimpin capem\b/.test(j) ||
      /^kepala cabang\b/.test(j)
    );
  }
  return false;
}

function jsonText(v) {
  if (v == null || v === '') return '{}';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

/** Salin field skor/satuan/target apa adanya dari Individu. */
function copyFromIndividu(k, h, id) {
  return {
    id,
    name: k.name,
    perspective: k.perspective,
    unit: k.unit, // satuan
    polarity: k.polarity,
    target: k.target,
    actual: k.actual,
    weight: k.weight, // bobot
    unit_name: h.unitCanon,
    jabatan: k.jabatan || h.jabatan,
    strategy_id: k.strategy_id || null,
    monthly_data: jsonText(k.monthly_data),
    monthly_target: jsonText(k.monthly_target),
    unit_type: h.unitType,
    status: k.status || 'Draft',
    description: k.description || null,
    formula: k.formula || null,
    objective: k.objective || null,
    sort_order: k.sort_order || 0,
    manual_indeks: k.manual_indeks,
    pic: PIC,
    kpi_code: null,
    parent_kpi_id: null,
  };
}

async function queryIndividu(conn, unitNorms, jabatanExact) {
  if (!unitNorms.length) return [];
  const [rows] = await conn.query(
    `SELECT * FROM kpis
     WHERE COALESCE(unit_type,'') = 'pegawai'
       AND LOWER(TRIM(unit_name)) IN (?)
       AND jabatan = ?
     ORDER BY sort_order ASC, name ASC`,
    [unitNorms, jabatanExact]
  );
  return rows;
}

async function queryIndividuByJabatans(conn, unitNorms, jabatans) {
  if (!unitNorms.length || !jabatans.length) return [];
  const [rows] = await conn.query(
    `SELECT * FROM kpis
     WHERE COALESCE(unit_type,'') = 'pegawai'
       AND LOWER(TRIM(unit_name)) IN (?)
       AND jabatan IN (?)
     ORDER BY sort_order ASC, name ASC`,
    [unitNorms, jabatans]
  );
  return rows;
}

/**
 * Gabungkan KPI dari beberapa jabatan kepala (Pj. vs non-Pj, ejaan beda).
 * Nama sama → utamakan jabatan pegawai (primary), lalu yang bobot/isi lebih lengkap.
 */
function mergeHeadKpis(rows, primaryJabatan) {
  const primaryNorm = norm(primaryJabatan);
  const byName = new Map();
  for (const row of rows) {
    const key = String(row.name || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, row);
      continue;
    }
    const prevPrimary = norm(prev.jabatan) === primaryNorm;
    const nextPrimary = norm(row.jabatan) === primaryNorm;
    if (nextPrimary && !prevPrimary) {
      byName.set(key, row);
      continue;
    }
    if (prevPrimary && !nextPrimary) continue;
    const prevMd =
      typeof prev.monthly_data === 'string'
        ? (() => {
            try {
              return JSON.parse(prev.monthly_data || '{}');
            } catch {
              return {};
            }
          })()
        : prev.monthly_data || {};
    const nextMd =
      typeof row.monthly_data === 'string'
        ? (() => {
            try {
              return JSON.parse(row.monthly_data || '{}');
            } catch {
              return {};
            }
          })()
        : row.monthly_data || {};
    const prevFill = Object.values(prevMd).filter((v) => v !== '' && v != null).length;
    const nextFill = Object.values(nextMd).filter((v) => v !== '' && v != null).length;
    if (nextFill > prevFill) byName.set(key, row);
  }
  return [...byName.values()].sort(
    (a, b) =>
      (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) ||
      String(a.name || '').localeCompare(String(b.name || ''), 'id')
  );
}

async function listHeadJabatans(conn, h, unitNorms) {
  const [jabRows] = await conn.query(
    `SELECT jabatan, COUNT(*) n
     FROM kpis
     WHERE COALESCE(unit_type,'') = 'pegawai'
       AND LOWER(TRIM(unit_name)) IN (?)
     GROUP BY jabatan
     ORDER BY n DESC`,
    [unitNorms]
  );
  const want = norm(h.jabatan);
  const heads = [];
  const seenExact = new Set();
  const push = (j) => {
    const raw = String(j || '').trim();
    if (!raw || seenExact.has(raw) || !isHead(h.org, raw)) return;
    // Simpan ejaan EXACT (Pj. vs non-Pj bisa punya set KPI berbeda di DB)
    seenExact.add(raw);
    heads.push(raw);
  };
  // Utamakan jabatan pegawai + semua ejaan kepala di unit (termasuk Pj./non-Pj)
  push(h.jabatan);
  for (const r of jabRows) {
    if (norm(r.jabatan) === want) push(r.jabatan);
  }
  for (const r of jabRows) push(r.jabatan);
  return heads;
}

async function loadIndividuSrc(conn, h) {
  const unitNorms = unitNameNorms(h.unit_name);
  const headJabs = await listHeadJabatans(conn, h, unitNorms);
  if (!headJabs.length) return [];

  const rows = await queryIndividuByJabatans(conn, unitNorms, headJabs);
  if (!rows.length) return [];
  return mergeHeadKpis(rows, h.jabatan);
}

async function syncKpiUnitFromPemimpin(db) {
  const [cols] = await db.query('SHOW COLUMNS FROM kpis');
  const colSet = new Set(cols.map((c) => c.Field));
  const [pegawai] = await db.query('SELECT name, jabatan, unit_name FROM pegawai');
  const [kpiHeadCounts] = await db.query(
    `SELECT LOWER(TRIM(unit_name)) un, jabatan, COUNT(*) n
     FROM kpis
     WHERE COALESCE(unit_type,'') = 'pegawai'
     GROUP BY LOWER(TRIM(unit_name)), jabatan`
  );
  const kpiCountMap = new Map();
  for (const r of kpiHeadCounts) {
    kpiCountMap.set(`${r.un}|${norm(r.jabatan)}`, Number(r.n) || 0);
  }
  function kpiCountFor(unitName, jabatan) {
    let best = 0;
    for (const un of unitNameNorms(unitName)) {
      best = Math.max(best, kpiCountMap.get(`${un}|${norm(jabatan)}`) || 0);
    }
    return best;
  }

  // Satu kepala per unit (hindari dobel insert jika ada Pj. + non-Pj di pegawai)
  const headsByUnit = new Map();
  for (const p of pegawai) {
    const org = orgOfUnit(p.unit_name);
    if (!org || !isHead(org, p.jabatan)) continue;
    const unitCanon = canonUnit(p.unit_name);
    const unitKey = norm(unitCanon);
    const cand = {
      ...p,
      org,
      unitCanon,
      unitType: unitTypeOfOrg(org),
    };
    const prev = headsByUnit.get(unitKey);
    if (!prev) {
      headsByUnit.set(unitKey, cand);
      continue;
    }
    const prevN = kpiCountFor(prev.unit_name, prev.jabatan);
    const nextN = kpiCountFor(cand.unit_name, cand.jabatan);
    if (nextN > prevN) headsByUnit.set(unitKey, cand);
    else if (nextN === prevN && /^pj\.?/i.test(prev.jabatan) && !/^pj\.?/i.test(cand.jabatan)) {
      headsByUnit.set(unitKey, cand);
    }
  }
  let heads = [...headsByUnit.values()];

  // Unit kantor yang sudah punya data Excel Nilai Kantor → jangan timpa lewat sync Individu
  const [excelUnits] = await db.query(
    `SELECT DISTINCT LOWER(TRIM(unit_name)) un FROM kpis WHERE pic = 'from-nilai-kantor-cabang'`
  );
  const excelUnitSet = new Set(excelUnits.map((r) => r.un));
  heads = heads.filter((h) => {
    if (!isUnitKantorOrg(h.org)) return true;
    if (excelUnitSet.has(norm(h.unitCanon)) || excelUnitSet.has(norm(h.unit_name))) {
      return false;
    }
    return true;
  });

  let inserted = 0;
  let deleted = 0;
  let deletedUpload = 0;
  const units = [];
  const skipped = [];
  /** Semua unit yang tersinkron (divisi/dept/ukk/unit/project/kck/kc/kcp) → hapus upload lama. */
  const syncedUnitNames = new Set();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Hanya ganti KPI Unit milik unit yang sumber Individu-nya ada.
    // Jangan DELETE global pic=from-individu-pemimpin: jika Individu kosong,
    // salinan Unit yang sudah tersimpan harus tetap (bukan ikut terhapus).
    let n = 0;
    for (const h of heads) {
      const src = await loadIndividuSrc(conn, h);
      if (!src.length) {
        skipped.push({
          org: h.org,
          unit_name: h.unit_name,
          jabatan: h.jabatan,
          name: h.name,
          reason: 'tidak ada KPI individu — KPI Unit yang ada dipertahankan',
        });
        continue;
      }

      const unitNames = new Set([h.unitCanon, h.unit_name].filter(Boolean));
      for (const [ck, cv] of Object.entries(CANON)) {
        if (norm(cv) === norm(h.unitCanon)) unitNames.add(cv);
      }
      const [delOne] = await conn.query(
        'DELETE FROM kpis WHERE pic = ? AND unit_name IN (?)',
        [PIC, [...unitNames]]
      );
      deleted += delOne.affectedRows || 0;

      const values = src.map((k) => {
        const id = `kpi_unit_${Date.now()}_${n}_${Math.floor(Math.random() * 1e6)}`;
        n += 1;
        return copyFromIndividu(k, h, id);
      });

      const fields = Object.keys(values[0]).filter((f) => colSet.has(f));
      await conn.query(`INSERT INTO kpis (${fields.join(',')}) VALUES ?`, [
        values.map((row) => fields.map((f) => row[f])),
      ]);
      inserted += values.length;

      syncedUnitNames.add(h.unitCanon);
      if (h.unit_name && h.unit_name !== h.unitCanon) syncedUnitNames.add(h.unit_name);
      for (const [k, v] of Object.entries(CANON)) {
        if (norm(v) === norm(h.unitCanon)) syncedUnitNames.add(v);
      }

      const bobot = src.reduce((s, k) => s + (parseFloat(k.weight) || 0), 0);
      units.push({
        org: h.org,
        unit_type: h.unitType,
        unit_name: h.unitCanon,
        jabatan: values[0].jabatan,
        pemimpin: h.name,
        kpi: values.length,
        bobot,
        satuan_sample: values[0].unit,
        target_sample: values[0].target,
      });
    }

    if (syncedUnitNames.size) {
      const names = [...syncedUnitNames];
      // Jangan hapus KPI Excel Nilai Kantor Cabang
      const [delUp] = await conn.query(
        `DELETE FROM kpis
         WHERE COALESCE(unit_type,'') IN ('divisi','departemen','ukk','unit','project','kck','kc','kcp')
           AND COALESCE(pic,'') NOT IN (?, 'from-nilai-kantor-cabang')
           AND unit_name IN (?)`,
        [PIC, names]
      );
      deletedUpload = delUp.affectedRows || 0;
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
    deletedUpload,
    inserted,
    unitCount: units.length,
    heads: heads.length,
    units,
    skipped,
  };
}

/**
 * Saat KPI Individu pemimpin diubah, salin field skor ke baris KPI Unit hasil sync.
 * Return jumlah baris Unit yang di-update.
 */
async function mirrorIndividuPemimpinToUnit(db, individuRow, patch = {}) {
  if (!individuRow) return 0;
  const unitTypeSrc = String(individuRow.unit_type || '').toLowerCase();
  if (unitTypeSrc && unitTypeSrc !== 'pegawai') return 0;

  const org = orgOfUnit(individuRow.unit_name);
  if (!org || !isHead(org, individuRow.jabatan)) return 0;

  const unitCanon = canonUnit(individuRow.unit_name);
  const unitType = unitTypeOfOrg(org);
  const name = String(individuRow.name || '').trim();
  if (!name || !unitCanon) return 0;

  const monthly_data =
    patch.monthly_data !== undefined ? patch.monthly_data : individuRow.monthly_data;
  const monthly_target =
    patch.monthly_target !== undefined ? patch.monthly_target : individuRow.monthly_target;
  const actual = patch.actual !== undefined ? patch.actual : individuRow.actual;
  const weight = patch.weight !== undefined ? patch.weight : individuRow.weight;
  const polarity = patch.polarity !== undefined ? patch.polarity : individuRow.polarity;
  const unit = patch.unit !== undefined ? patch.unit : individuRow.unit;
  const target = patch.target !== undefined ? patch.target : individuRow.target;
  const perspective =
    patch.perspective !== undefined ? patch.perspective : individuRow.perspective;
  const manual_indeks =
    patch.manual_indeks !== undefined ? patch.manual_indeks : individuRow.manual_indeks;

  const [res] = await db.query(
    `UPDATE kpis SET
       monthly_data = ?, monthly_target = ?, actual = ?,
       weight = ?, polarity = ?, unit = ?, target = ?,
       perspective = COALESCE(?, perspective), manual_indeks = ?
     WHERE pic = ?
       AND COALESCE(unit_type,'') = ?
       AND LOWER(TRIM(unit_name)) = LOWER(TRIM(?))
       AND LOWER(TRIM(name)) = LOWER(TRIM(?))`,
    [
      jsonText(monthly_data),
      jsonText(monthly_target),
      actual,
      weight,
      polarity,
      unit,
      target,
      perspective || null,
      manual_indeks != null && manual_indeks !== '' ? manual_indeks : null,
      PIC,
      unitType,
      unitCanon,
      name,
    ]
  );
  return res.affectedRows || 0;
}

module.exports = {
  syncKpiUnitFromPemimpin,
  mirrorIndividuPemimpinToUnit,
  PIC,
  orgOfUnit,
  isHead,
  isUnitKantorOrg,
  canonUnit,
  unitNameNorms,
  unitTypeOfOrg,
};
