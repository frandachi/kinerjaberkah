const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
const { monthKeysInclusive } = require('./kpi-scoring');

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

function parseJsonArr(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return [];
}

function idsInclude(ids, kpiId) {
  const needle = String(kpiId);
  return parseJsonArr(ids).some((id) => String(id) === needle);
}

/**
 * Untuk KPI yang terkait mutasi aktif, hanya bulan di periode scorecard
 * (lama / baru) yang boleh diubah.
 * Return null = tidak ada batasan mutasi.
 *
 * Matching by KPI id in old_kpi_ids / new_kpi_ids only — jangan kunci
 * semua KPI yang kebetulan unit+jabatan sama (false lock untuk rekan).
 */
async function getMutationAllowedMonths(db, kpi) {
  if (!db || !kpi || kpi.id == null) return null;

  try {
    const [rows] = await db.query(
      `SELECT old_kpi_ids, new_kpi_ids, old_period_start, old_period_end,
              new_period_start, new_period_end
       FROM mutation_history
       WHERE status = 'active'
       ORDER BY effective_date DESC, id DESC`
    );
    if (!rows.length) return null;

    for (const m of rows) {
      if (idsInclude(m.old_kpi_ids, kpi.id)) {
        return monthKeysInclusive(m.old_period_start, m.old_period_end);
      }
      if (idsInclude(m.new_kpi_ids, kpi.id)) {
        // Buka semua bulan periode setelah mutasi (tidak di-clamp ke hari ini)
        return monthKeysInclusive(m.new_period_start, m.new_period_end);
      }
    }
    return null;
  } catch (err) {
    console.warn('getMutationAllowedMonths:', err.message);
    return null;
  }
}

function getEffectiveLockedMonths(kpi, mutationAllowedMonths = null) {
  // Bulan di luar periode mutasi dianggap terkunci
  if (Array.isArray(mutationAllowedMonths) && mutationAllowedMonths.length) {
    const allow = new Set(mutationAllowedMonths);
    return MONTHS.filter((m) => !allow.has(m));
  }
  return [];
}

function isMonthLockedForUser(kpi, month, _userRole, mutationAllowedMonths = null) {
  const locked = getEffectiveLockedMonths(kpi, mutationAllowedMonths);
  return locked.includes(month);
}

/** Gabungkan monthly_data; bulan terkunci (di luar periode mutasi) tidak diubah */
function mergeMonthlyDataRespectingLock(existingKpi, incomingMonthlyData, _userRole, mutationAllowedMonths = null) {
  const existing = parseMonthlyData(existingKpi.monthly_data);
  const incoming = incomingMonthlyData || {};
  const locked = new Set(getEffectiveLockedMonths(existingKpi, mutationAllowedMonths));
  const out = { ...existing };
  for (const [month, value] of Object.entries(incoming)) {
    if (locked.has(month)) continue;
    out[month] = value;
  }
  return out;
}

function mergeMonthlyTarget(existingKpi, incomingMonthlyTarget, mutationAllowedMonths = null) {
  const existing = parseMonthlyData(existingKpi.monthly_target);
  const incoming = incomingMonthlyTarget || {};
  const locked = new Set(getEffectiveLockedMonths(existingKpi, mutationAllowedMonths));
  const out = { ...existing };
  for (const [month, value] of Object.entries(incoming)) {
    if (locked.has(month)) continue;
    out[month] = value;
  }
  return out;
}

module.exports = {
  MONTHS,
  parseLockedMonths,
  buildLockedMonthsFromData,
  IMPORTED_REALISASI_MONTHS,
  getMutationAllowedMonths,
  getEffectiveLockedMonths,
  isMonthLockedForUser,
  mergeMonthlyDataRespectingLock,
  mergeMonthlyTarget,
  parseJsonArr,
};
