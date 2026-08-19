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
    // NOTE: the built frontend (LogTrails.js) calls `logs.map(...)` directly
    // on this endpoint's result with no page/limit params - it expects a
    // bare array, not a {data, pagination} envelope. Cap at a generous limit
    // (instead of the old default 100) so the log trail view isn't silently
    // truncated, without risking an unbounded query on a fast-growing table.
    const [logs] = await db.query(
      'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 2000'
    );

    res.json(logs);
  } catch (error) {
    console.error('Get logs error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
