/**
 * Import KPI Individu dari template Excel per pegawai
 * (JABATAN | NAMA | NPP | PERSPEKTIF | INDIKATOR | Ukuran | Bobot | Target Tahunan | Jan R/T … Des R/T).
 *
 * KPI individu disimpan per pasangan unit_name + jabatan pegawai (sesuai data pegawai),
 * jadi pegawai dicocokkan dulu lalu unit & jabatan diambil dari tabel pegawai.
 */

const { normalizeNameKey, stripNameSymbols, normalizePerspectiveKey } = require('./kpi-master');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
const UNIT_CODES = ['percentage', 'currency', 'score', 'number'];
const PERSPECTIVES = ['financial', 'customer', 'internal_process', 'learning_growth'];
const POLARITIES = ['maximize', 'minimize', 'faster', 'range'];

function normSpace(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

function normalizeName(v) {
  return normSpace(v)
    .toLowerCase()
    .replace(/[.,'`’"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeJabatan(v) {
  return normSpace(v).toLowerCase();
}

function cleanNpp(v) {
  return normSpace(v)
    .replace(/^npp\s*[.:\-]?\s*/i, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function nppHead(v) {
  const head = cleanNpp(v).split('.')[0] || '';
  return head.replace(/^0+(?=\d)/, '');
}

function namesSimilar(a, b) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return true;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const tx = new Set(x.split(' ').filter((t) => t.length > 1));
  const ty = y.split(' ').filter((t) => t.length > 1);
  if (!tx.size || !ty.length) return false;
  const overlap = ty.filter((t) => tx.has(t)).length;
  return overlap / Math.min(tx.size, ty.length) >= 0.5;
}

function buildPegawaiIndex(rows) {
  const byNpp = new Map();
  const byHead = new Map();
  const byName = new Map();
  const push = (map, key, row) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  };
  for (const row of rows) {
    push(byNpp, cleanNpp(row.npp), row);
    push(byHead, nppHead(row.npp), row);
    push(byName, normalizeName(row.name), row);
  }
  return { byNpp, byHead, byName };
}

function pickByJabatan(cands, jabatan) {
  const j = normalizeJabatan(jabatan);
  if (!j) return null;
  const hit = cands.filter((c) => normalizeJabatan(c.jabatan) === j);
  return hit.length === 1 ? hit[0] : null;
}

function pickByName(cands, nama) {
  const hit = cands.filter((c) => namesSimilar(c.name, nama));
  return hit.length === 1 ? hit[0] : null;
}

/** @returns {{ pegawai: object|null, via: string, reason?: string }} */
function matchPegawai(index, { npp, nama, jabatan, unit_name: unitName }) {
  const full = cleanNpp(npp);
  if (full && index.byNpp.has(full)) {
    const cands = index.byNpp.get(full);
    const one = cands.length === 1 ? cands[0] : pickByName(cands, nama);
    if (one) return { pegawai: one, via: 'npp' };
  }

  const head = nppHead(npp);
  if (head && index.byHead.has(head)) {
    const cands = index.byHead.get(head);
    const one = cands.length === 1 ? cands[0] : (pickByName(cands, nama) || pickByJabatan(cands, jabatan));
    if (one) return { pegawai: one, via: 'npp' };
  }

  const nm = normalizeName(nama);
  if (nm && index.byName.has(nm)) {
    let cands = index.byName.get(nm);
    if (cands.length > 1 && unitName) {
      const u = normalizeJabatan(unitName);
      const byUnit = cands.filter((c) => normalizeJabatan(c.unit_name) === u);
      if (byUnit.length) cands = byUnit;
    }
    const one = cands.length === 1 ? cands[0] : pickByJabatan(cands, jabatan);
    if (one) return { pegawai: one, via: 'nama' };
    return { pegawai: null, via: 'nama', reason: `Nama "${normSpace(nama)}" dimiliki ${cands.length} pegawai; lengkapi NPP` };
  }

  if (!full && !nm) return { pegawai: null, via: '', reason: 'Nama dan NPP kosong di file' };
  return { pegawai: null, via: '', reason: 'Pegawai tidak ditemukan berdasarkan NPP maupun nama' };
}

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cleanMonthly(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const m of MONTHS) {
    const n = toNumberOrNull(obj[m]);
    if (n !== null) out[m] = String(Math.round(n * 10000) / 10000);
  }
  return out;
}

/** Indeks bulan berjalan (0 = Jan) menurut waktu WIB. */
function currentMonthIndexWib(now = new Date()) {
  return new Date(now.getTime() + 7 * 3600 * 1000).getUTCMonth();
}

/**
 * @param {number} [maxMonthIdx] realisasi untuk bulan setelah indeks ini diabaikan
 *   (bulan yang belum berjalan); target bulanan tetap disimpan.
 */
function sanitizeKpi(raw, idx, maxMonthIdx = 11) {
  const name = normSpace(raw && raw.name).slice(0, 255);
  if (!name) return null;
  const unit = UNIT_CODES.includes(raw.unit) ? raw.unit : 'percentage';
  const perspective = PERSPECTIVES.includes(raw.perspective) ? raw.perspective : 'financial';
  const polarity = POLARITIES.includes(raw.polarity) ? raw.polarity : 'maximize';
  const weight = Math.max(0, Math.min(999.99, toNumberOrNull(raw.weight) || 0));
  const monthly_data = cleanMonthly(raw.monthly_data);
  const futureDropped = MONTHS.slice(maxMonthIdx + 1).filter((m) => monthly_data[m] !== undefined);
  futureDropped.forEach((m) => delete monthly_data[m]);
  const monthly_target = cleanMonthly(raw.monthly_target);
  const filled = MONTHS.filter((m) => monthly_data[m] !== undefined);
  const actual = filled.length ? Number(monthly_data[filled[filled.length - 1]]) : 0;
  return {
    name,
    unit,
    perspective,
    polarity,
    weight: Math.round(weight * 100) / 100,
    target: normSpace(raw.target).slice(0, 255),
    monthly_data,
    monthly_target,
    actual: Math.round(actual * 100) / 100,
    sort_order: idx + 1,
    futureDropped,
  };
}

const PERSPECTIVE_PREFIX = { financial: 'FIN', customer: 'CUS', internal_process: 'IBP', learning_growth: 'LNG' };

/** Kunci pencocokan nama master: abaikan huruf besar/kecil, spasi, dan tanda baca. */
function masterNameKey(name) {
  return normalizeNameKey(name).replace(/[^\p{L}\p{N}%]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Satu nama KPI per perspektif = satu kode master. Nama yang sudah ada dipakai ulang,
 * nama baru dibuatkan kode berikutnya (KPI-FIN-01, KPI-CUS-01, …).
 */
function createMasterResolver(masterRows, takenCodes = []) {
  const byKey = new Map();
  const used = new Set(takenCodes);
  const created = [];
  const register = (master, names) => {
    names.forEach((nm) => {
      const k = masterNameKey(nm);
      if (k && !byKey.has(`${master.perspective}|${k}`)) byKey.set(`${master.perspective}|${k}`, master);
    });
  };

  for (const row of masterRows) {
    const master = {
      code: row.code,
      name: stripNameSymbols(row.name),
      perspective: normalizePerspectiveKey(row.perspective),
      unit: UNIT_CODES.includes(row.unit) ? row.unit : null,
      polarity: POLARITIES.includes(row.polarity) ? row.polarity : null,
      isNew: false,
    };
    used.add(row.code);
    let aliases = row.match_names;
    if (typeof aliases === 'string') {
      try { aliases = JSON.parse(aliases); } catch { aliases = []; }
    }
    register(master, [row.name, ...(Array.isArray(aliases) ? aliases : [])]);
  }

  function resolve(kpi) {
    const perspective = normalizePerspectiveKey(kpi.perspective);
    const key = masterNameKey(kpi.name);
    if (!key) return null;
    const hit = byKey.get(`${perspective}|${key}`);
    if (hit) return hit;

    let code = null;
    if (perspective === 'financial' && key === 'laba bersih' && !used.has('KPI-FIN-01')) code = 'KPI-FIN-01';
    if (!code) {
      const prefix = PERSPECTIVE_PREFIX[perspective] || 'GEN';
      // KPI-FIN-01 dicadangkan untuk Laba Bersih (lihat kpi-master RESERVED_CODES).
      let n = perspective === 'financial' ? 2 : 1;
      do {
        code = `KPI-${prefix}-${String(n).padStart(2, '0')}`;
        n += 1;
      } while (used.has(code));
    }
    used.add(code);
    const master = {
      code,
      name: stripNameSymbols(kpi.name),
      perspective,
      unit: kpi.unit,
      polarity: kpi.polarity,
      isNew: true,
    };
    byKey.set(`${perspective}|${key}`, master);
    created.push(master);
    return master;
  }

  return { resolve, created };
}

module.exports = {
  MONTHS,
  normSpace,
  normalizeName,
  normalizeJabatan,
  cleanNpp,
  namesSimilar,
  buildPegawaiIndex,
  matchPegawai,
  sanitizeKpi,
  currentMonthIndexWib,
  masterNameKey,
  createMasterResolver,
};
