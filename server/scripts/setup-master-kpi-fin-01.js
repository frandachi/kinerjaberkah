/**
 * Setup Model B: master KPI-FIN-01 + link Laba Bersih + agregasi.
 * Usage: node scripts/setup-master-kpi-fin-01.js
 */
require('dotenv').config({ quiet: true });
const db = require('../db');
const { setupMasterKpiFin01 } = require('../lib/kpi-master');

(async () => {
  try {
    const result = await setupMasterKpiFin01(db);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('setup-master-kpi-fin-01 failed:', err);
    process.exit(1);
  } finally {
    try { await db.end(); } catch { /* ignore */ }
  }
})();
