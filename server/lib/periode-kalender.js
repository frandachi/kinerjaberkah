const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
const SETTING_KEY = 'periode_kalender';

const DEFAULT = () => ({
  tahunAktif: String(new Date().getFullYear()),
  bulanTutup: {},
});

let tableReady = null;

async function ensureTable(db) {
  if (!tableReady) {
    tableReady = db
      .query(
        `CREATE TABLE IF NOT EXISTS app_settings (
          setting_key VARCHAR(64) PRIMARY KEY,
          setting_value JSON NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`
      )
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

function normalizeSettings(raw) {
  const base = DEFAULT();
  if (!raw || typeof raw !== 'object') return base;
  const tahunAktif = String(raw.tahunAktif || base.tahunAktif);
  const src = raw.bulanTutup && typeof raw.bulanTutup === 'object' ? raw.bulanTutup : {};
  const bulanTutup = {};
  for (const m of MONTHS) {
    if (src[m]) bulanTutup[m] = true;
  }
  return { tahunAktif, bulanTutup };
}

async function getPeriodeSettings(db) {
  await ensureTable(db);
  const [rows] = await db.query(
    'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
    [SETTING_KEY]
  );
  if (!rows.length) return DEFAULT();
  let val = rows[0].setting_value;
  if (typeof val === 'string') {
    try {
      val = JSON.parse(val);
    } catch {
      return DEFAULT();
    }
  }
  return normalizeSettings(val);
}

async function savePeriodeSettings(db, body) {
  await ensureTable(db);
  const settings = normalizeSettings(body);
  await db.query(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [SETTING_KEY, JSON.stringify(settings)]
  );
  return settings;
}

/** Bulan yang ditutup buku — tidak boleh diedit realisasi/target. */
async function getClosedMonths(db) {
  const settings = await getPeriodeSettings(db);
  return MONTHS.filter((m) => !!settings.bulanTutup[m]);
}

function isMonthClosed(closedMonths, month) {
  return Array.isArray(closedMonths) && closedMonths.includes(month);
}

module.exports = {
  MONTHS,
  SETTING_KEY,
  DEFAULT,
  normalizeSettings,
  getPeriodeSettings,
  savePeriodeSettings,
  getClosedMonths,
  isMonthClosed,
};
