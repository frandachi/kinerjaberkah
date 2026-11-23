const POLARITY_VALUES = ['maximize', 'minimize', 'faster', 'range', 'stabilize'];
const DEFAULT_BATAS = {
  A: [60, 100, 105, 110],
  B: [80, 100, 110, 120],
  C: [60, 100, 120, 140],
};
const MINIMIZE_A_BATAS = [60, 100, 110, 120];
const MINIMIZE_B_BATAS = [40, 60, 80, 100];
const MINIMIZE_C_BATAS = [0.25, 1, 2, 3];
function batasOfRow(row) {
  const nums = [row && row.batas2, row && row.batas3, row && row.batas4, row && row.batas5].map(Number);
  if (nums.every((n) => Number.isFinite(n))) return nums;
  if (row && Array.isArray(row.batas) && row.batas.length === 4 && row.batas.every((n) => Number.isFinite(Number(n)))) {
    return row.batas.map(Number);
  }
  return DEFAULT_BATAS[row && row.skala] || DEFAULT_BATAS.A;
}
const POL_META_FALLBACK = {
  maximize_a: { rumus: 'maximize', skala: 'A', batas: DEFAULT_BATAS.A },
  maximize_b: { rumus: 'maximize', skala: 'B', batas: DEFAULT_BATAS.B },
  maximize_c: { rumus: 'maximize', skala: 'C', batas: DEFAULT_BATAS.C },
  minimize: { rumus: 'minimize', skala: 'A', batas: MINIMIZE_A_BATAS },
  minimize_a: { rumus: 'minimize', skala: 'A', batas: MINIMIZE_A_BATAS },
  minimize_b: { rumus: 'minimize', skala: 'B', batas: MINIMIZE_B_BATAS },
  minimize_c: { rumus: 'stabilize', skala: 'C', batas: MINIMIZE_C_BATAS },
  faster: { rumus: 'faster', skala: 'B', batas: DEFAULT_BATAS.B },
  range: { rumus: 'range', skala: 'A', batas: DEFAULT_BATAS.A },
  stabilize: { rumus: 'stabilize', skala: 'C', batas: MINIMIZE_C_BATAS },
};
let polMeta = { ...POL_META_FALLBACK };

function setPolaritasMeta(rows) {
  const next = { ...POL_META_FALLBACK };
  for (const row of rows || []) {
    const kode = String(row.kode || '').trim().toLowerCase();
    const rumus = String(row.rumus || '').trim().toLowerCase();
    const skala = String(row.skala || '').trim().toUpperCase();
    if (kode && POLARITY_VALUES.includes(rumus) && ['A', 'B', 'C'].includes(skala)) {
      next[kode] = { rumus, skala, batas: batasOfRow(row) };
    }
  }
  polMeta = next;
}

function polaritySkala(polarity) {
  const value = (polarity || '').toString().trim().toLowerCase();
  return polMeta[value] ? polMeta[value].skala : '';
}

function polarityBatas(polarity) {
  const value = (polarity || '').toString().trim().toLowerCase();
  return polMeta[value] ? polMeta[value].batas : null;
}

function normalizePolarity(polarity) {
  const value = (polarity || 'maximize').toString().trim().toLowerCase();
  if (polMeta[value]) return polMeta[value].rumus;
  if (POLARITY_VALUES.includes(value)) return value;
  return 'maximize';
}

/**
 * Hitung % pencapaian sesuai polaritas:
 * - Maximize A/B/C: (Realisasi ÷ Target) × 100%  [wajib sama untuk target +/−]
 * - Minimize/Faster: (Target ÷ Realisasi) × 100%
 * - Minimize C / stabilize: ROUND(Realisasi − Target, 2) %
 * - Target 0 & Realisasi 0 → Minimize/Faster 100%; Maximize 0%
 * - Target 0 & Realisasi ≠ 0 (Maximize) → 0%
 */
function computePencapaianByPolarity(actual, target, polarity = 'maximize', options = {}) {
  const a = parseFloat(actual);
  const t = parseFloat(target);
  if (Number.isNaN(a) || Number.isNaN(t)) return 0;

  const mode = normalizePolarity(polarity);
  const lowerRatio = options.lowerRatio ?? 0.9;
  const upperRatio = options.upperRatio ?? 1.1;

  // Minimize C / stabilize: ROUND(Realisasi − Target, 2) %
  if (mode === 'stabilize') {
    return Math.round((a - t) * 100) / 100;
  }

  // Target 0 & Realisasi 0:
  // - Minimize/Faster: 100% (tidak ada biaya/kejadian)
  // - Maximize: 0% (belum ada realisasi)
  if (t === 0 && a === 0) {
    if (mode === 'minimize' || mode === 'faster') return 100;
    return 0;
  }

  // Minimize/Faster: Target ÷ Realisasi (positif & negatif).
  if (mode === 'minimize' || mode === 'faster') {
    if (a === 0) return 100;
    return (t / a) * 100;
  }

  if (mode === 'range') {
    if (t === 0) return 0;
    const bb = t * lowerRatio;
    const ba = t * upperRatio;
    if (a >= bb && a <= ba) return 100;
    if (a < bb) return bb !== 0 ? (a / bb) * 100 : 0;
    return a !== 0 ? (ba / a) * 100 : 0;
  }

  // Maximize A / B / C (dan maximize generik): Realisasi / Target × 100%
  if (t === 0) return 0;
  return (a / t) * 100;
}

module.exports = { normalizePolarity, computePencapaianByPolarity, POLARITY_VALUES, setPolaritasMeta, polaritySkala, polarityBatas, DEFAULT_BATAS, MINIMIZE_A_BATAS, MINIMIZE_B_BATAS, MINIMIZE_C_BATAS };
