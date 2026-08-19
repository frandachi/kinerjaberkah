/**
 * Setup semua master KPI (KPI-FIN-01, KPI-CUS-01, …) + link + agregasi.
 * Usage: node scripts/setup-all-master-kpis.js
 */
require('dotenv').config({ quiet: true });
const db = require('../db');
const { setupAllMasterKpis } = require('../lib/kpi-master');

(async () => {
  try {
    const result = await setupAllMasterKpis(db);
    console.log(JSON.stringify({
      masters: result.masters,
      linked: result.linked,
      sample: result.aggregates?.slice(0, 8),
      fin01: result.aggregates?.find((a) => a.code === 'KPI-FIN-01'),
    }, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('setup-all-master-kpis failed:', err);
    process.exit(1);
  } finally {
    try { await db.end(); } catch { /* ignore */ }
  }
})();
