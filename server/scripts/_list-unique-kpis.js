require('dotenv').config({ quiet: true });
const db = require('./db');

(async () => {
  const [rows] = await db.query(`
    SELECT name,
      MIN(perspective) AS perspective,
      MIN(unit) AS unit,
      MIN(polarity) AS polarity,
      COUNT(*) AS c
    FROM kpis
    WHERE COALESCE(unit_type, '') <> 'master'
    GROUP BY name
    ORDER BY perspective, name
  `);
  console.log('UNIQUE', rows.length);
  const byP = {};
  rows.forEach((r) => {
    const p = String(r.perspective || '?').toLowerCase();
    byP[p] = (byP[p] || 0) + 1;
    console.log([r.perspective, r.c, r.name, r.unit || '', r.polarity || ''].join('\t'));
  });
  console.log('BY_P', JSON.stringify(byP));
  await db.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
