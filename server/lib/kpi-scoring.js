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
      const val = parseFloat(monthlyTarget[m]);
      if (!Number.isNaN(val) && val > 0) return val;
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

function computePencapaianPercent(actual, target, polarity = 'maximize') {
  return computePencapaianByPolarity(actual, target, polarity);
}

function computePencapaianTotal(monthlyData, monthlyTarget, unitType, polarity = 'maximize') {
  const mode = normalizePolarity(polarity);
  if (isSumTargetUnit(unitType)) {
    const actual = sumMonthlyValues(monthlyData);
    const target = sumMonthlyValues(monthlyTarget);
    return computePencapaianByPolarity(actual, target, mode);
  }
  const actual = computeYtdActual(unitType, monthlyData);
  const target = computeAnnualTargetFromMonthly(unitType, monthlyTarget);
  if (target > 0) {
    return computePencapaianByPolarity(actual, target, mode);
  }
  return avgMonthlyRealisasi(monthlyData);
}

function computeIndeksFromPencapaian(pencapaianPercent) {
  const p = parseFloat(pencapaianPercent);
  if (Number.isNaN(p) || p <= 0) return 0;
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

function computeKpiYtdScores(kpi) {
  const unitType = normalizeUnit(kpi.unit);
  const weight = parseFloat(kpi.weight) || 0;
  const monthlyTarget = parseJsonField(kpi.monthly_target);
  const monthlyData = parseJsonField(kpi.monthly_data);
  const polarity = normalizePolarity(kpi.polarity);
  const targetNum = computeAnnualTargetFromMonthly(unitType, monthlyTarget);
  const actualNum = computeYtdActual(unitType, monthlyData);
  const pencapaian = computePencapaianTotal(monthlyData, monthlyTarget, unitType, polarity);
  const indeks = resolveIndeks(kpi, pencapaian);
  const hasil = weight * (indeks / 100);
  return { targetNum, actualNum, pencapaian, indeks, hasil };
}

module.exports = {
  MONTHS,
  computeKpiYtdScores,
  computeIndeksFromPencapaian,
  computePencapaianPercent,
  computeHasil: (bobot, indeks) => (parseFloat(bobot) || 0) * ((parseFloat(indeks) || 0) / 100),
};
