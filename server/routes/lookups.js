const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorize');

const router = express.Router();

router.get('/units', authenticateToken, async (req, res) => {
  try {
    const [units] = await db.query(
      'SELECT DISTINCT unit_name FROM users WHERE unit_name IS NOT NULL AND unit_name != "" AND unit_name != "-" ORDER BY unit_name'
    );
    res.json(units.map(u => u.unit_name));
  } catch (error) {
    console.error('Get units error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/jabatans', authenticateToken, async (req, res) => {
  try {
    const { unit_name } = req.query;
    let queryStr = 'SELECT DISTINCT jabatan FROM users WHERE jabatan IS NOT NULL AND jabatan != "" AND jabatan != "-" AND role != "superadmin"';
    let queryParams = [];

    if (unit_name && unit_name !== 'All') {
      queryStr += ' AND unit_name = ?';
      queryParams.push(unit_name);
    }

    queryStr += ' ORDER BY jabatan';
    const [jabatans] = await db.query(queryStr, queryParams);
    res.json(jabatans.map(j => j.jabatan));
  } catch (error) {
    console.error('Get jabatans error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/leaders', authenticateToken, async (req, res) => {
  try {
    const { unit_name } = req.query;
    const fs = require('fs');
    const path = require('path');
    const mappingPath = path.join(__dirname, '../../unit_mapping.json');
    let parentUnit = null;

    if (unit_name && fs.existsSync(mappingPath)) {
      const unitMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

      let lookupUnit = unit_name.trim();
      if (lookupUnit.toLowerCase().startsWith('cabang') || lookupUnit.toLowerCase().startsWith('divisi')) {
        lookupUnit = 'Kantor ' + lookupUnit;
      }

      let mappedParent = unitMapping[lookupUnit.toLowerCase()];
      if (mappedParent) {
        if (mappedParent.toLowerCase().startsWith('kantor ')) {
          parentUnit = mappedParent.substring(7).trim();
        } else {
          parentUnit = mappedParent;
        }
      }
    }

    let queryStr = `
      SELECT name, npp, jabatan, unit_name 
      FROM users 
      WHERE (jabatan LIKE "%Pemimpin%" OR jabatan LIKE "%Wakil%" OR jabatan LIKE "%Head%") 
        AND role != "superadmin" 
        AND name IS NOT NULL 
    `;
    let queryParams = [];

    if (unit_name) {
      if (parentUnit) {
        queryStr += ` AND (unit_name = ? OR unit_name = ?)`;
        queryParams.push(unit_name, parentUnit);
      } else {
        queryStr += ` AND unit_name = ?`;
        queryParams.push(unit_name);
      }
    }

    queryStr += ` ORDER BY unit_name, name`;

    const [leaders] = await db.query(queryStr, queryParams);
    res.json(leaders);
  } catch (error) {
    console.error('Get leaders error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/logs', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    // Hanya admin/superadmin (authorizeRole). Frontend LogTrails mengharapkan array polos.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 2000, 1), 5000);
    const [logs] = await db.query(
      `SELECT
         al.id,
         al.user_id,
         COALESCE(NULLIF(al.user_name, ''), u.name, u.username, al.user_id) AS user_name,
         COALESCE(NULLIF(al.user_role, ''), u.role, '') AS user_role,
         u.unit_name AS unit_name,
         al.action,
         al.details,
         al.ip_address,
         al.created_at,
         CASE
           WHEN al.action LIKE '%KPI%' OR al.action LIKE '%APPROVE%' OR al.action LIKE '%SUBMIT%' OR al.action LIKE '%LOCK%' THEN 'KPI'
           WHEN al.action LIKE '%USER%' OR al.action LIKE '%ROLE%' OR al.action LIKE '%LOGIN%' OR al.action LIKE '%LOGOUT%' OR al.action LIKE '%PASSWORD%' THEN 'Akses'
           WHEN al.action LIKE '%MUTATION%' THEN 'Mutasi'
           WHEN al.action LIKE '%PARAM%' OR al.action LIKE '%SATUAN%' OR al.action LIKE '%POLARITAS%' THEN 'Parameter'
           ELSE 'Sistem'
         END AS module
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT ?`,
      [limit]
    );

    const mapped = logs.map((row) => {
      let details = row.details;
      if (typeof details === 'string') {
        try {
          const parsed = JSON.parse(details);
          details = parsed && typeof parsed === 'object'
            ? (parsed.message || parsed._message || details)
            : details;
        } catch (_) { /* keep raw */ }
      }
      return { ...row, details };
    });

    res.json(mapped);
  } catch (error) {
    console.error('Get logs error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
