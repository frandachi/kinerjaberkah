#!/usr/bin/env node
/**
 * Sync Average Index dari Skor Final Manual.xlsx → kpis.manual_indeks
 * + normalisasi bobot 13 KPI scorecard + bobot 0 untuk KPI di luar Excel.
 */
const fs = require('fs');
const path = require('path');
const db = require('/home/pasiongo/kinerjaberkah/server/db');
const scoring = require('/home/pasiongo/kinerjaberkah/server/lib/kpi-scoring');

const maps = JSON.parse(fs.readFileSync('/tmp/kb-unit-maps.json', 'utf8'));
const payload = JSON.parse(fs.readFileSync('/tmp/kb-manual-indexes-sync.json', 'utf8'));
const A = maps.A || {};
const UNIT = maps.UNIT || {};
const HQ = maps.HQ || [];
const BLANK = payload.blank_index_default != null ? Number(payload.blank_index_default) : 1;

function nU(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
function rU(s) {
  const k = nU(s);
  return A[k] || k;
}
function parseMaybe(v) {
  if (v == null) return {};
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v || '{}');
  } catch {
    return {};
  }
}
function normKpiName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\(konsolidasi\)/g, '')
    .replace(/\bindeks\b/g, 'index')
    .replace(/[\/().,_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function monthFill(k, f) {
  const o = k[f] && typeof k[f] === 'object' ? k[f] : {};
  return Object.values(o).filter((v) => v != null && v !== '').length;
}
function dataScore(k) {
  return (
    monthFill(k, 'monthly_target') * 1000 +
    monthFill(k, 'monthly_data') * 10 +
    (k.target != null && String(k.target).trim() !== '' && String(k.target).trim() !== '0' ? 1 : 0)
  );
}
function sourceRank(k) {
  if (k.pic === 'from-nilai-kantor-cabang' || k.pic === 'from-individu-pemimpin') return 0;
  const ut = String(k.unit_type || '').toLowerCase();
  if (['kck', 'kc', 'kcp', 'kk'].includes(ut)) return 1;
  return 9;
}
function isUnitScorecard(k) {
  const pic = String(k.pic || '');
  if (pic === 'from-nilai-kantor-cabang' || pic === 'from-individu-pemimpin') return true;
  const ut = String(k.unit_type || '').toLowerCase();
  return ['kck', 'kc', 'kcp', 'kk', 'divisi', 'departemen', 'ukk', 'unit', 'project'].includes(ut);
}
function expandManualName(name) {
  let s = String(name || '').trim();
  if (/^KCPS\b/i.test(s)) s = s.replace(/^KCPS\b/i, 'Cabang Pembantu Syariah');
  else if (/^KCP\b/i.test(s)) s = s.replace(/^KCP\b/i, 'Cabang Pembantu');
  else if (/^KC\b/i.test(s)) s = s.replace(/^KC\b/i, 'Cabang');
  return s;
}

const canonByKey = new Map();
for (const u of Object.values(UNIT)) {
  if (u && u.name) {
    const k = rU(u.name);
    if (!canonByKey.has(k)) canonByKey.set(k, u.name);
  }
}
for (const name of HQ) {
  const k = rU(name);
  if (!canonByKey.has(k)) canonByKey.set(k, name);
}
const kodeToName = new Map();
for (const [kode, u] of Object.entries(UNIT)) {
  if (u && u.name) kodeToName.set(String(kode), u.name);
}

function resolveKeyFromManual(row) {
  if (row.kode != null && kodeToName.has(String(row.kode))) {
    return rU(kodeToName.get(String(row.kode)));
  }
  return rU(expandManualName(row.name));
}

/** Matcher per excel KPI (urutan = payload.kpis) — mencakup alias nama di app */
const KPI_MATCHERS = [
  (n) => n.includes('laba bersih'),
  (n) =>
    n.includes('efisiensi biaya') ||
    (n.includes('efisiensi') && n.includes('atk')) ||
    (n.includes('biaya atk') && n.includes('listrik')) ||
    (n.includes('biaya atk') && n.includes('bbm')),
  (n) => n.includes('cost of fund'),
  (n) => n.includes('pembiayaan syariah') && n.includes('dblm'),
  (n) =>
    ((n.includes('dpk syariah') || n.includes('dana pihak ketiga syariah')) && n.includes('dblm')) ||
    (n === 'dpk syariah dblm' || n === 'dpk syariah/dblm'),
  (n) =>
    n.includes('pertumbuhan') &&
    n.includes('kredit') &&
    !n.includes('kol') &&
    !n.includes('col'),
  (n) =>
    n.includes('pertumbuhan') &&
    (n.includes('dpk') || n.includes('dana pihak ketiga')),
  (n) => n.includes('total aset') || n === 'aset' || n.endsWith(' aset') || n === 'total asset',
  (n) => (n.includes('npl') || n.includes('npf')) && n.includes('gross'),
  (n) =>
    (n.includes('kol') || n.includes('col')) &&
    (n.includes('<1') || n.includes('1 tahun') || n.includes('< 1') || n.includes('col 1') || n.includes('kol 1') || n.includes('kol.1') || n.includes('col. 1')),
  (n) =>
    n.includes('penyelesaian') &&
    (n.includes('temuan') || n.includes('tindak lanjut') || n.includes('audit')),
  (n) => n.includes('culture'),
  (n) => n.includes('employee') && n.includes('integrity'),
];
/** Nama standar untuk insert jika KPI belum ada di unit */
const KPI_CREATE_NAMES = [
  'Laba Bersih',
  'Efisiensi Biaya ATK, BBC, Listrik, Air, BBM, Konsumsi dan Pertemuan Rapat',
  'Cost of Fund',
  'Pembiayaan Syariah/DBLM',
  'Dana Pihak Ketiga Syariah/DBLM',
  'Pertumbuhan O/S Kredit',
  'Pertumbuhan O/S DPK',
  'Total Aset',
  'NPL Gross',
  'O/S Kredit Kol.1 yang direalisasikan selama <1 Tahun',
  'Penyelesaian Temuan Audit External dan Internal sesuai Komitmen',
  'Culture Implementation Index',
  'Employee Integrity Index',
];
function isExcelScorecardName(n) {
  return KPI_MATCHERS.some((fn) => fn(n));
}
function newKpiId() {
  return `kpi_nkc_sync_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function dedupe(list) {
  const best = new Map();
  for (const k of list) {
    const key = normKpiName(k.name);
    if (!key) continue;
    const prev = best.get(key);
    if (!prev) {
      best.set(key, k);
      continue;
    }
    const sNew = dataScore(k),
      sOld = dataScore(prev);
    if (
      sNew > sOld ||
      (sNew === sOld &&
        (sourceRank(k) < sourceRank(prev) ||
          (sourceRank(k) === sourceRank(prev) && (+k.weight || 0) > (+prev.weight || 0))))
    ) {
      best.set(key, k);
    }
  }
  return [...best.values()];
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
function round4(n) {
  return Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
}

(async () => {
  const weightByExcel = new Map();
  for (const k of payload.kpis) {
    weightByExcel.set(k.excel_name, k.weight_pct);
  }

  const [all] = await db.query(`
    SELECT id, name, unit_name, unit_type, weight, target, actual, polarity, perspective,
           pic, unit, monthly_data, monthly_target, status, manual_indeks
    FROM kpis
    WHERE unit_name IS NOT NULL AND TRIM(unit_name) <> ''
  `);
  for (const r of all) {
    r.monthly_data = parseMaybe(r.monthly_data);
    r.monthly_target = parseMaybe(r.monthly_target);
  }

  const byKey = new Map();
  for (const k of all) {
    if (!isUnitScorecard(k)) continue;
    if (String(k.unit_type || '').toLowerCase() === 'pegawai') continue;
    const key = rU(k.unit_name);
    if (!byKey.has(key)) byKey.set(key, { names: new Set(), rows: [] });
    byKey.get(key).names.add(k.unit_name);
    byKey.get(key).rows.push(k);
  }

  let updated = 0;
  let zeroed = 0;
  let unitsOk = 0;
  let unitsMiss = 0;
  const unitReports = [];
  const dry = process.argv.includes('--dry');

  for (const row of payload.rows) {
    const key = resolveKeyFromManual(row);
    const g = byKey.get(key);
    if (!g) {
      unitsMiss += 1;
      unitReports.push({ excel: row.name, kode: row.kode, status: 'missing_unit' });
      continue;
    }
    const rows = dedupe(g.rows);
    const usedIds = new Set();
    const updates = [];

    // template unit_type/pic dari baris existing
    const tpl = rows[0] || g.rows[0];
    const unitNameKeep = canonByKey.get(key) || [...g.names][0];
    // prefer the name that already has most filled data
    const preferredUnitName = (() => {
      const counts = new Map();
      for (const r of g.rows) {
        counts.set(r.unit_name, (counts.get(r.unit_name) || 0) + dataScore(r));
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || unitNameKeep;
    })();

    for (let i = 0; i < payload.kpis.length; i++) {
      const meta = payload.kpis[i];
      const excelKey = meta.excel_name;
      const matchFn = KPI_MATCHERS[i];
      let hit = rows.find((r) => matchFn(normKpiName(r.name)) && !usedIds.has(r.id));
      let idx = row.indexes[excelKey];
      if (idx == null) idx = BLANK;
      if (!hit) {
        // cari di semua rows unit (termasuk yang ter-dedupe keluar) lalu create
        hit = g.rows.find((r) => matchFn(normKpiName(r.name)) && !usedIds.has(r.id));
      }
      if (!hit) {
        const newId = newKpiId();
        updates.push({
          id: newId,
          name: KPI_CREATE_NAMES[i],
          excel: excelKey,
          manual_indeks: round4(idx),
          weight: meta.weight_pct,
          status: 'create',
          unit_name: preferredUnitName,
          unit_type: tpl?.unit_type || 'kcp',
          polarity: tpl?.polarity || 'maximize_a',
          unit: tpl?.unit || 'percentage',
          perspective: tpl?.perspective || 'financial',
          pic: 'from-nilai-kantor-cabang',
        });
        usedIds.add(newId);
        continue;
      }
      usedIds.add(hit.id);
      updates.push({
        id: hit.id,
        name: hit.name,
        excel: excelKey,
        manual_indeks: round4(idx),
        weight: meta.weight_pct,
        status: 'update',
      });
    }

    // zero weight for extras/dupes agar total bobot = 100 seperti Excel
    const extras = [];
    for (const r of g.rows) {
      if (usedIds.has(r.id)) continue;
      extras.push({
        id: r.id,
        name: r.name,
        reason: isExcelScorecardName(normKpiName(r.name)) ? 'duplicate' : 'extra',
      });
    }

    let created = 0;
    if (!dry) {
      for (const u of updates) {
        if (u.status === 'update') {
          await db.query(`UPDATE kpis SET manual_indeks = ?, weight = ? WHERE id = ?`, [
            u.manual_indeks,
            u.weight,
            u.id,
          ]);
          const live = g.rows.find((x) => x.id === u.id);
          if (live) {
            live.manual_indeks = u.manual_indeks;
            live.weight = u.weight;
          }
          updated += 1;
        } else if (u.status === 'create') {
          await db.query(
            `INSERT INTO kpis (id, name, perspective, unit, polarity, target, actual, weight, unit_name, unit_type, pic, status, manual_indeks, monthly_data, monthly_target)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, '{}', '{}')`,
            [
              u.id,
              u.name,
              u.perspective,
              u.unit,
              u.polarity,
              null,
              0,
              u.weight,
              u.unit_name,
              u.unit_type,
              u.pic,
              u.manual_indeks,
            ]
          );
          g.rows.push({
            id: u.id,
            name: u.name,
            unit_name: u.unit_name,
            unit_type: u.unit_type,
            weight: u.weight,
            manual_indeks: u.manual_indeks,
            monthly_data: {},
            monthly_target: {},
            polarity: u.polarity,
            unit: u.unit,
            perspective: u.perspective,
            pic: u.pic,
          });
          created += 1;
          updated += 1;
        }
      }
      for (const x of extras) {
        await db.query(`UPDATE kpis SET weight = 0 WHERE id = ?`, [x.id]);
        const live = g.rows.find((r) => r.id === x.id);
        if (live) live.weight = 0;
        zeroed += 1;
      }
    }

    const allForScore = [
      ...g.rows.map((r) => {
        const u = updates.find((x) => x.id === r.id && (x.status === 'update' || x.status === 'create'));
        if (u) return { ...r, manual_indeks: u.manual_indeks, weight: u.weight, name: u.name };
        if (extras.some((x) => x.id === r.id)) return { ...r, weight: 0 };
        return r;
      }),
      // dry-run creates: append virtual rows
      ...updates
        .filter((u) => u.status === 'create' && !g.rows.some((r) => r.id === u.id))
        .map((u) => ({
          id: u.id,
          name: u.name,
          weight: u.weight,
          manual_indeks: u.manual_indeks,
          monthly_data: {},
          monthly_target: {},
          polarity: 'maximize_a',
          unit: 'percentage',
        })),
    ];
    const forScore = allForScore.filter((r) => (parseFloat(r.weight) || 0) > 0);
    const s = scoring.summarizeKpiSet(forScore);
    const skor = s.scoredCount > 0 ? Number(s.skor) || 0 : 0;
    const excel = row.total == null ? null : Number(row.total);
    // Bandingkan pada 2 desimal (tampilan skor Excel & UI).
    const delta = excel == null ? null : round2(round2(excel) - round2(skor));
    unitsOk += 1;
    unitReports.push({
      excel: row.name,
      kode: row.kode,
      app: canonByKey.get(key) || [...g.names][0],
      excelSkor: excel == null ? null : round2(excel),
      appSkor: round2(skor),
      delta,
      matchedKpis: updates.filter((u) => u.status === 'update').length,
      createdKpis: updates.filter((u) => u.status === 'create').length,
      missingKpis: updates.filter((u) => u.status === 'kpi_missing').length,
      extras: extras.length,
      weight: round2(forScore.reduce((a, r) => a + (parseFloat(r.weight) || 0), 0)),
    });
  }

  const selisih = unitReports.filter((u) => u.delta != null && Math.abs(u.delta) >= 0.005);
  selisih.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const out = {
    dry,
    summary: {
      excelRows: payload.rows.length,
      unitsUpdated: unitsOk,
      unitsMissing: unitsMiss,
      kpiUpdated: updated,
      kpiZeroed: zeroed,
      matched: unitReports.filter((u) => u.delta != null && Math.abs(u.delta) < 0.005).length,
      selisih: selisih.length,
    },
    selisih: selisih.slice(0, 40),
    missingUnits: unitReports.filter((u) => u.status === 'missing_unit'),
    sampleOk: unitReports.filter((u) => u.delta != null && Math.abs(u.delta) < 0.005).slice(0, 5),
  };
  fs.writeFileSync('/tmp/kb-sync-manual-result.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
