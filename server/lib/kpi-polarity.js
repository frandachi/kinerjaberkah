const POLARITY_VALUES = ['maximize', 'minimize', 'faster', 'range'];

function normalizePolarity(polarity) {
  const value = (polarity || 'maximize').toString().trim().toLowerCase();
  if (POLARITY_VALUES.includes(value)) return value;
  return 'maximize';
}

/**
 * Hitung % pencapaian sesuai polaritas:
 * - Target 0 & Realisasi 0 → 100% (Maximize & Minimize)
 * - Maximize: (Realisasi ÷ Target) × 100; Realisasi 0 → 0%; Target 0 & Realisasi ≠ 0 → 0%
 * - Minimize: (Target ÷ Realisasi) × 100; Realisasi 0 → 100%
 * - Target negatif (Maximize/Minimize): (1 + selisih ÷ |Target|) × 100, selisih = Realisasi − Target
 *   untuk Maximize dan Target − Realisasi untuk Minimize. Realisasi = Target → 100%.
 */
function computePencapaianByPolarity(actual, target, polarity = 'maximize', options = {}) {
  const a = parseFloat(actual);
  const t = parseFloat(target);
  if (Number.isNaN(a) || Number.isNaN(t)) return 0;

  const mode = normalizePolarity(polarity);
  const lowerRatio = options.lowerRatio ?? 0.9;
  const upperRatio = options.upperRatio ?? 1.1;

  if (t === 0 && a === 0) return 100;

  if (t < 0 && (mode === 'maximize' || mode === 'minimize')) {
    const gap = mode === 'maximize' ? a - t : t - a;
    return (1 + gap / Math.abs(t)) * 100;
  }

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

  if (t === 0) return 0;
  return (a / t) * 100;
}

module.exports = { normalizePolarity, computePencapaianByPolarity, POLARITY_VALUES };
