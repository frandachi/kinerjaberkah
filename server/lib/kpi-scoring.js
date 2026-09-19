const { normalizePolarity, computePencapaianByPolarity } = require('./kpi-polarity');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

function isSumTargetUnit(unitType) {
  return unitType === 'currency' || unitType === 'number';
}

function isFlatTargetUnit(unitType) {
  return unitType === 'percentage' || unitType === 'score';
}

function sumMonthlyValues(monthlyObj) {
  return MONTHS.reduce((sum, m) => {
    const val = parseFloat(monthlyObj?.[m]);
    return sum + (Number.isNaN(val) ? 0 : val);
  }, 0);
}

function avgMonthlyValues(monthlyObj) {
  let sum = 0;
  let count = 0;
  MONTHS.forEach((m) => {
    const val = parseFloat(monthlyObj?.[m]);
    if (!Number.isNaN(val)) {
      sum += val;
      count += 1;
    }
  });
  return count > 0 ? sum / count : 0;
}

function avgMonthlyRealisasi(monthlyData) {
  let sum = 0;
  let count = 0;
  MONTHS.forEach((m) => {
    const raw = monthlyData?.[m];
    if (raw === undefined || raw === null || raw === '') return;
    const val = parseFloat(raw);
    if (Number.isNaN(val)) return;
    sum += val;
    count += 1;
  });
  return count > 0 ? sum / count : 0;
}

function computeAnnualTargetFromMonthly(unitType, monthlyTarget) {
  if (!monthlyTarget || typeof monthlyTarget !== 'object') return 0;
  if (isSumTargetUnit(unitType)) {
    return sumMonthlyValues(monthlyTarget);
  }
  if (isFlatTargetUnit(unitType)) {
    for (const m of MONTHS) {
      const raw = monthlyTarget[m];
      if (raw === undefined || raw === null || raw === '') continue;
      const val = parseFloat(raw);
      if (!Number.isNaN(val)) return val; // termasuk 0
    }
  }
  return 0;
}

function computeYtdActual(unitType, monthlyData) {
  if (!monthlyData || typeof monthlyData !== 'object') return 0;
  if (isSumTargetUnit(unitType)) {
    return sumMonthlyValues(monthlyData);
  }
  return avgMonthlyValues(monthlyData);
}

function hasFilledMonth(monthlyObj) {
  if (!monthlyObj || typeof monthlyObj !== 'object') return false;
  return MONTHS.some((m) => {
    const raw = monthlyObj[m];
    return raw !== undefined && raw !== null && raw !== '' && !Number.isNaN(parseFloat(raw));
  });
}

function computePencapaianPercent(actual, target, polarity = 'maximize') {
  return computePencapaianByPolarity(actual, target, polarity);
}

function monthTargetValue(monthlyTarget, month, annualTarget) {
  const raw = monthlyTarget?.[month];
  if (raw !== undefined && raw !== null && raw !== '') {
    const val = parseFloat(raw);
    if (!Number.isNaN(val)) return val;
  }
  const annual = parseFloat(annualTarget);
  if (!Number.isNaN(annual)) return annual;
  const fallback = computeAnnualTargetFromMonthly('percentage', monthlyTarget);
  return Number.isNaN(fallback) ? 0 : fallback;
}

function computePencapaianTotal(monthlyData, monthlyTarget, unitType, polarity = 'maximize', annualTarget) {
  const mode = normalizePolarity(polarity);
  if (isSumTargetUnit(unitType)) {
    const actual = sumMonthlyValues(monthlyData);
    const target = hasFilledMonth(monthlyTarget)
      ? sumMonthlyValues(monthlyTarget)
      : (parseFloat(annualTarget) || 0);
    return computePencapaianByPolarity(actual, target, mode);
  }
  let sum = 0;
  let count = 0;
  MONTHS.forEach((m) => {
    const raw = monthlyData?.[m];
    if (raw === undefined || raw === null || raw === '') return;
    const actual = parseFloat(raw);
    if (Number.isNaN(actual)) return;
    const target = monthTargetValue(monthlyTarget, m, annualTarget);
    sum += computePencapaianByPolarity(actual, target, mode);
    count += 1;
  });
  return count > 0 ? sum / count : 0;
}

function computeIndeksFromPencapaian(pencapaianPercent) {
  const p = parseFloat(pencapaianPercent);
  if (Number.isNaN(p)) return 0;
  if (p < 60) return 1;
  if (p < 80) return 2;
  if (p <= 100) return 3;
  if (p <= 110) return 4;
  return 5;
}

function resolveIndeks(kpi, pencapaianPercent) {
  const hasManual = kpi.manual_indeks !== undefined && kpi.manual_indeks !== null && kpi.manual_indeks !== '';
  if (hasManual) {
    const manual = parseFloat(kpi.manual_indeks);
    return Number.isNaN(manual) ? 0 : manual;
  }
  return computeIndeksFromPencapaian(pencapaianPercent);
}

function normalizeUnit(unit) {
  if (['percentage', 'currency', 'score', 'number'].includes(unit)) return unit;
  const u = (unit || '').toLowerCase();
  if (u === '%' || u.includes('persen')) return 'percentage';
  if (u.includes('rp') || u.includes('rupiah') || u.includes('juta')) return 'currency';
  if (u.includes('indeks') || u.includes('skor')) return 'score';
  if (u.includes('angka')) return 'number';
  return 'percentage';
}

function parseJsonField(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function pickMonthly(obj, allowedMonths) {
  const src = parseJsonField(obj);
  if (!Array.isArray(allowedMonths) || !allowedMonths.length) return src;
  const allow = new Set(allowedMonths);
  const out = {};
  for (const m of MONTHS) {
    if (allow.has(m) && src[m] !== undefined) out[m] = src[m];
  }
  return out;
}

function monthKeysInclusive(startDate, endDate, { clampToToday = false } = {}) {
  if (!startDate || !endDate) return [];
  const start = new Date(startDate);
  let end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (clampToToday) {
    const now = new Date();
    if (end > now) end = now;
  }
  if (end < start) return [];
  const keys = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    keys.push(MONTHS[cur.getMonth()]);
    cur.setMonth(cur.getMonth() + 1);
    if (keys.length > 24) break;
  }
  return keys;
}

function formatMonthRangeLabel(monthKeys = []) {
  if (!monthKeys.length) return '—';
  if (monthKeys.length === 1) return monthKeys[0];
  return `${monthKeys[0]}–${monthKeys[monthKeys.length - 1]}`;
}

function predikatFromPencapaian(pencapaianPercent, scored = true) {
  if (!scored) return '-';
  const p = parseFloat(pencapaianPercent);
  if (Number.isNaN(p)) return '-';
  if (p < 60) return 'Kurang';
  if (p < 80) return 'Cukup';
  if (p <= 100) return 'Baik';
  if (p <= 110) return 'Baik Sekali';
  return 'Istimewa';
}

function computeKpiYtdScores(kpi, options = {}) {
  const unitType = normalizeUnit(kpi.unit);
  const weight = parseFloat(kpi.weight) || 0;
  const months = options.months;
  const monthlyTarget = pickMonthly(kpi.monthly_target, months);
  const monthlyData = pickMonthly(kpi.monthly_data, months);
  const polarity = normalizePolarity(kpi.polarity);
  const targetNum = computeAnnualTargetFromMonthly(unitType, monthlyTarget);
  const actualNum = computeYtdActual(unitType, monthlyData);
  const scored = hasFilledMonth(monthlyData);
  const pencapaian = scored
    ? computePencapaianTotal(monthlyData, monthlyTarget, unitType, polarity, kpi.target)
    : 0;
  const indeks = scored ? resolveIndeks(kpi, pencapaian) : 0;
  const hasil = weight * (indeks / 100);
  return { targetNum, actualNum, pencapaian, indeks, hasil, scored };
}

function summarizeKpiSet(kpis = [], months = null) {
  let scoredWeight = 0;
  let weightedPencapaian = 0;
  let sumHasil = 0;
  let sumWeight = 0;
  let scoredCount = 0;
  let tercapai = 0;
  for (const kpi of kpis) {
    const weight = parseFloat(kpi.weight) || 0;
    const { pencapaian, hasil, scored } = computeKpiYtdScores(kpi, { months });
    sumWeight += weight;
    sumHasil += hasil;
    if (!scored) continue;
    const w = weight > 0 ? weight : 1;
    scoredWeight += w;
    weightedPencapaian += w * Math.min(pencapaian, 120);
    scoredCount += 1;
    if (pencapaian >= 100) tercapai += 1;
  }
  const pencapaian = scoredWeight > 0 ? weightedPencapaian / scoredWeight : 0;
  const skor = sumWeight > 0 ? (sumHasil / sumWeight) * 100 : 0;
  return {
    pencapaian,
    skor,
    status: predikatFromPencapaian(pencapaian, scoredCount > 0),
    scoredCount,
    kpiTotal: kpis.length,
    kpiTercapai: tercapai,
    totalWeight: sumWeight,
  };
}

module.exports = {
  MONTHS,
  computeKpiYtdScores,
  computeIndeksFromPencapaian,
  computePencapaianPercent,
  computeYtdActual,
  pickMonthly,
  monthKeysInclusive,
  formatMonthRangeLabel,
  predikatFromPencapaian,
  summarizeKpiSet,
  normalizeUnit,
  computeHasil: (bobot, indeks) => (parseFloat(bobot) || 0) * ((parseFloat(indeks) || 0) / 100),
};
