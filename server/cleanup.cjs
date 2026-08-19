const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function clean() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'kpi_corporate'
  });

  // Clean trailing/leading whitespace and \r\n
  await connection.query("UPDATE objectives SET name = TRIM(REPLACE(REPLACE(name, '\r', ''), '\n', ''))");
  await connection.query("UPDATE strategies SET name = TRIM(REPLACE(REPLACE(name, '\r', ''), '\n', ''))");
  await connection.query("UPDATE kpis SET objective = TRIM(REPLACE(REPLACE(objective, '\r', ''), '\n', '')), name = TRIM(REPLACE(REPLACE(name, '\r', ''), '\n', ''))");

  // Find duplicates and merge them in objectives
  const [dupObjs] = await connection.query(`
    SELECT name, perspective, MIN(id) as keep_id
    FROM objectives
    GROUP BY name, perspective
    HAVING COUNT(*) > 1
  `);

  for (const dup of dupObjs) {
    const [others] = await connection.query("SELECT id, divisi FROM objectives WHERE name = ? AND perspective = ? AND id != ?", [dup.name, dup.perspective, dup.keep_id]);
    for (const other of others) {
      // Merge divisi
      const [main] = await connection.query("SELECT divisi FROM objectives WHERE id = ?", [dup.keep_id]);
      const combinedDivisi = [...new Set([...(main[0].divisi||'').split(','), ...(other.divisi||'').split(',')].map(d=>d.trim()).filter(Boolean))].join(', ');
      await connection.query("UPDATE objectives SET divisi = ? WHERE id = ?", [combinedDivisi, dup.keep_id]);
      
      // Update strategies to point to keep_id
      await connection.query("UPDATE strategies SET objective_id = ? WHERE objective_id = ?", [dup.keep_id, other.id]);
      // Delete the duplicate
      await connection.query("DELETE FROM objectives WHERE id = ?", [other.id]);
    }
  }

  // Find duplicates and merge them in strategies
  const [dupStrats] = await connection.query(`
    SELECT name, objective_id, MIN(id) as keep_id
    FROM strategies
    GROUP BY name, objective_id
    HAVING COUNT(*) > 1
  `);

  for (const dup of dupStrats) {
    const [others] = await connection.query("SELECT id FROM strategies WHERE name = ? AND objective_id = ? AND id != ?", [dup.name, dup.objective_id, dup.keep_id]);
    for (const other of others) {
      // Just delete the duplicates
      await connection.query("DELETE FROM strategies WHERE id = ?", [other.id]);
    }
  }

  console.log("Cleanup done.");
  await connection.end();
}
clean();