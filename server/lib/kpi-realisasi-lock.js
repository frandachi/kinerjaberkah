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

function getEffectiveLockedMonths(kpi) {
  const locked = parseLockedMonths(kpi.monthly_data_locked);
  if (locked.length > 0) return locked;

  const md = parseMonthlyData(kpi.monthly_data);
  return IMPORTED_REALISASI_MONTHS.filter((m) => {
    const val = md[m];
    return val !== undefined && val !== null && val !== '' && Number(val) !== 0;
  });
}

function isMonthLockedForUser(kpi, month, userRole) {
  if (userRole === 'admin' || userRole === 'superadmin') return false;
  return getEffectiveLockedMonths(kpi).includes(month);
}

/** Gabungkan monthly_data baru; bulan terkunci dipertahankan dari data lama */
function mergeMonthlyDataRespectingLock(existingKpi, incomingMonthlyData, userRole) {
  const existing = parseMonthlyData(existingKpi.monthly_data);
  const incoming = incomingMonthlyData || {};
  const locked = getEffectiveLockedMonths(existingKpi);
  const merged = { ...existing, ...incoming };

  if (userRole === 'admin' || userRole === 'superadmin') {
    return merged;
  }

  locked.forEach((month) => {
    if (existing[month] !== undefined) {
      merged[month] = existing[month];
    }
  });

  return merged;
}

module.exports = {
  MONTHS,
  parseLockedMonths,
  buildLockedMonthsFromData,
  getEffectiveLockedMonths,
  isMonthLockedForUser,
  mergeMonthlyDataRespectingLock,
};
