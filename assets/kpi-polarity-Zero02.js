const f = [
  { value: 'maximize', label: 'Maximize (More is better)', shortLabel: 'Maximize', formula: 'Pencapaian = (Realisasi ÷ Target) × 100%' },
  { value: 'minimize', label: 'Minimize (Less is better)', shortLabel: 'Minimize', formula: 'Pencapaian = (Target ÷ Realisasi) × 100%' },
  { value: 'faster', label: 'Faster (Time-based)', shortLabel: 'Faster', formula: 'Pencapaian = (Target waktu ÷ Realisasi waktu) × 100%' },
  { value: 'range', label: 'Range (90%–110% = 100%)', shortLabel: 'Range', formula: 'BB ≤ Realisasi ≤ BA → 100%; di luar range proporsional' },
];

function c(t) {
  const i = (t || 'maximize').toString().trim().toLowerCase();
  return ['maximize', 'minimize', 'faster', 'range'].includes(i) ? i : 'maximize';
}

/**
 * Pencapaian % sesuai polaritas:
 * - Target 0 & Realisasi 0 → 100% (Maximize & Minimize)
 * - Maximize: (Realisasi ÷ Target) × 100; Realisasi 0 → 0%; Target 0 & Realisasi ≠ 0 → 0%
 * - Minimize: (Target ÷ Realisasi) × 100; Realisasi 0 → 100%
 */
function b(t, i, l = 'maximize', s = {}) {
  const a = parseFloat(t);
  const e = parseFloat(i);
  if (Number.isNaN(a) || Number.isNaN(e)) return 0;
  const n = c(l);
  const m = s.lowerRatio ?? 0.9;
  const u = s.upperRatio ?? 1.1;

  if (e === 0 && a === 0) return 100;

  if (n === 'minimize' || n === 'faster') {
    if (a === 0) return 100;
    return (e / a) * 100;
  }

  if (n === 'range') {
    if (e === 0) return 0;
    const r = e * m;
    const o = e * u;
    if (a >= r && a <= o) return 100;
    if (a < r) return r !== 0 ? (a / r) * 100 : 0;
    return a !== 0 ? (o / a) * 100 : 0;
  }

  if (e === 0) return 0;
  return (a / e) * 100;
}

export { f as P, b as c, c as n };
