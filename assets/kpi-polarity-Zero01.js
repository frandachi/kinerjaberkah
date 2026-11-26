const f = [
  { value: 'maximize', label: 'Maximize (More is better)', shortLabel: 'Maximize', formula: 'Pencapaian = (Realisasi ÷ Target) × 100%' },
  { value: 'minimize', label: 'Minimize (Less is better)', shortLabel: 'Minimize', formula: 'Pencapaian = (Target ÷ Realisasi) × 100%' },
  { value: 'faster', label: 'Faster (Time-based)', shortLabel: 'Faster', formula: 'Pencapaian = (Target waktu ÷ Realisasi waktu) × 100%' },
  { value: 'range', label: 'Range (90%–110% = 100%)', shortLabel: 'Range', formula: 'BB ≤ Realisasi ≤ BA → 100%; di luar range proporsional' },
];

const kbBatasPreset = { A: [60, 100, 105, 110], B: [80, 100, 110, 120], C: [60, 100, 120, 140] };
const kbMinA = [60, 100, 110, 120];
const kbMinB = [40, 60, 80, 100];
const kbMinC = [0.25, 1, 2, 3];
function kbRowBatas(row, skala) {
  const fromList = Array.isArray(row && row.batas) ? row.batas.map(Number) : [row && row.batas2, row && row.batas3, row && row.batas4, row && row.batas5].map(Number);
  if (fromList.length === 4 && fromList.every((n) => Number.isFinite(n))) return fromList;
  return kbBatasPreset[skala] || kbBatasPreset.A;
}
const kbPolBase = {
  maximize_a: { rumus: 'maximize', skala: 'A', batas: kbBatasPreset.A },
  maximize_b: { rumus: 'maximize', skala: 'B', batas: kbBatasPreset.B },
  maximize_c: { rumus: 'maximize', skala: 'C', batas: kbBatasPreset.C },
  minimize: { rumus: 'minimize', skala: 'A', batas: kbMinA },
  minimize_a: { rumus: 'minimize', skala: 'A', batas: kbMinA },
  minimize_b: { rumus: 'minimize', skala: 'B', batas: kbMinB },
  minimize_c: { rumus: 'stabilize', skala: 'C', batas: kbMinC },
  faster: { rumus: 'faster', skala: 'B', batas: kbBatasPreset.B },
  range: { rumus: 'range', skala: 'A', batas: kbBatasPreset.A },
  stabilize: { rumus: 'stabilize', skala: 'C', batas: kbMinC },
};
let kbPol = { ...kbPolBase };
function kbLoadPol() {
  try {
    const rows = JSON.parse(localStorage.getItem('kb_polaritas') || 'null');
    if (!Array.isArray(rows)) return;
    const next = { ...kbPolBase };
    for (const row of rows) {
      const kode = String(row.kode || '').trim().toLowerCase();
      const rumus = String(row.rumus || '').trim().toLowerCase();
      const skala = String(row.skala || '').trim().toUpperCase();
      if (kode && ['maximize', 'minimize', 'faster', 'range', 'stabilize'].includes(rumus) && ['A', 'B', 'C'].includes(skala)) next[kode] = { rumus, skala, batas: kbRowBatas(row, skala) };
    }
    kbPol = next;
  } catch (e) { /* cache kosong */ }
}
function c(t) {
  kbLoadPol();
  const i = (t || 'maximize').toString().trim().toLowerCase();
  if (kbPol[i]) return kbPol[i].rumus;
  return ['maximize', 'minimize', 'faster', 'range', 'stabilize'].includes(i) ? i : 'maximize';
}
function kbSkala(t) {
  kbLoadPol();
  const i = String(t || '').trim().toLowerCase();
  return kbPol[i] ? kbPol[i].skala : '';
}
function kbIndeksFrom(p, batas) {
  const [b2, b3, b4, b5] = batas;
  if (p < b2) return 1;
  if (p < b3) return 2;
  if (p < b4) return 3;
  if (p <= b5) return 4;
  return 5;
}
function kbStabIndeks(diff, batas) {
  const x = parseFloat(diff);
  let mid = Number(batas && batas[0]);
  let high = Number(batas && batas[1]);
  if (!(mid > 0 && high > mid)) { mid = 0.25; high = 1; }
  if (!Number.isFinite(x)) return 0;
  if (x < -1e-9) return 5;
  if (Math.abs(x) <= 1e-9) return 4;
  if (x <= mid) return 3;
  if (x <= high) return 2;
  return 1;
}
function kbIndeks(p, polarity, unit, ps) {
  kbLoadPol();
  const raw = String(polarity || '').trim().toLowerCase();
  if (raw === 'minimize_c' || raw === 'stabilize' || (kbPol[raw] && kbPol[raw].rumus === 'stabilize')) {
    return kbStabIndeks(p, (kbPol[raw] && kbPol[raw].batas) || kbMinC);
  }
  if (raw === 'minimize') return kbIndeksFrom(p, String(unit || '') === 'score' ? kbMinB : kbMinA);
  if (kbPol[raw] && kbPol[raw].batas && kbPol[raw].rumus !== 'stabilize') return kbIndeksFrom(p, kbPol[raw].batas);
  const rumus = ['minimize', 'faster', 'range', 'maximize'].includes(raw) ? raw : 'maximize';
  let kode = 'maximize_a';
  if (rumus === 'minimize') kode = String(unit || '') === 'score' ? 'minimize_b' : 'minimize_a';
  else if (rumus === 'faster') kode = 'faster';
  else if (rumus === 'range') kode = 'range';
  else if (/learning|growth|pembelajaran|\blng\b/i.test(String(ps || ''))) kode = 'maximize_c';
  else if (String(unit || '') === 'score') kode = 'maximize_b';
  return kbIndeksFrom(p, (kbPol[kode] && kbPol[kode].batas) || kbBatasPreset.A);
}

function b(t, i, l = 'maximize', s = {}) {
  const a = parseFloat(t);
  const e = parseFloat(i);
  if (Number.isNaN(a) || Number.isNaN(e)) return 0;
  const n = c(l);
  const m = s.lowerRatio ?? 0.9;
  const u = s.upperRatio ?? 1.1;
  if (n === 'stabilize') {
    // Minimize C: Achievement = Actual − Target
    return a - e;
  }
  if (n === 'minimize' || n === 'faster') {
    if (a === 0) return 100;
    return (e / a) * 100;
  }
  if (e < 0 && n === 'maximize') {
    return (1 + (a - e) / Math.abs(e)) * 100;
  }
  if (e === 0) {
    if (a === 0) return 100;
    return 100;
  }
  if (n === 'range') {
    const r = e * m;
    const o = e * u;
    if (a >= r && a <= o) return 100;
    if (a < r) return r !== 0 ? (a / r) * 100 : a === 0 ? 100 : 0;
    return a !== 0 ? (o / a) * 100 : 0;
  }
  return (a / e) * 100;
}

export { f as P, b as c, c as n, kbSkala as s, kbIndeks as i };
