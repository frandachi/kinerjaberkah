const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

function parseLockedMonths(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Bulan yang punya realisasi dari import superadmin → dikunci untuk role user */
function buildLockedMonthsFromData(monthlyData) {
  if (!monthlyData || typeof monthlyData !== 'object') return [];
  return MONTHS.filter((m) => {
    const val = monthlyData[m];
    return val !== undefined && val !== null && val !== '' && Number(val) !== 0;
  });
}

const IMPORTED_REALISASI_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul'];

function parseMonthlyData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Input realisasi/target dibuka untuk semua role.
 * monthly_data_locked dipertahankan di DB untuk audit, tapi tidak lagi memblokir input.
 */
function getEffectiveLockedMonths(_kpi) {
  return [];
}

function isMonthLockedForUser(_kpi, _month, _userRole) {
  return false;
}

/** Gabungkan monthly_data baru (tanpa kunci bulan) */
function mergeMonthlyDataRespectingLock(existingKpi, incomingMonthlyData, _userRole) {
  const existing = parseMonthlyData(existingKpi.monthly_data);
  const incoming = incomingMonthlyData || {};
  return { ...existing, ...incoming };
}

function mergeMonthlyTarget(existingKpi, incomingMonthlyTarget) {
  const existing = parseMonthlyData(existingKpi.monthly_target);
  const incoming = incomingMonthlyTarget || {};
  return { ...existing, ...incoming };
}

module.exports = {
  MONTHS,
  parseLockedMonths,
  buildLockedMonthsFromData,
  IMPORTED_REALISASI_MONTHS,
  getEffectiveLockedMonths,
  isMonthLockedForUser,
  mergeMonthlyDataRespectingLock,
  mergeMonthlyTarget,
};
