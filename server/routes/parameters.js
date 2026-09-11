const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorize');

const router = express.Router();

const createCrudRoutes = (tableName, { readRoles = ['superadmin', 'admin'] } = {}) => {
  router.get(`/${tableName}`, authenticateToken, authorizeRole(...readRoles), async (req, res) => {
    try {
      const [rows] = await db.query(`SELECT * FROM ${tableName} ORDER BY created_at ASC`);
      res.json(rows);
    } catch (error) {
      console.error(`Get ${tableName} error:`, error.message);
      res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
  });

  router.post(`/${tableName}`, authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
    try {
      const { name } = req.body;
      const prefix = tableName === 'satuans' ? 'sat_' : 'tar_';
      const id = prefix + Date.now();
      await db.query(`INSERT INTO ${tableName} (id, name) VALUES (?, ?)`, [id, name]);
      res.status(201).json({ id, name });
    } catch (error) {
      console.error(`Create ${tableName} error:`, error.message);
      res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
  });

  router.put(`/${tableName}/:id`, authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
    try {
      const { name } = req.body;
      await db.query(`UPDATE ${tableName} SET name = ? WHERE id = ?`, [name, req.params.id]);
      res.json({ id: req.params.id, name });
    } catch (error) {
      console.error(`Update ${tableName} error:`, error.message);
      res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
  });

  router.delete(`/${tableName}/:id`, authenticateToken, authorizeRole('superadmin'), async (req, res) => {
    try {
      await db.query(`DELETE FROM ${tableName} WHERE id = ?`, [req.params.id]);
      res.json({ message: 'Deleted successfully' });
    } catch (error) {
      console.error(`Delete ${tableName} error:`, error.message);
      res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
  });
};

createCrudRoutes('satuans', { readRoles: ['superadmin', 'admin', 'user'] });
createCrudRoutes('targets', { readRoles: ['superadmin', 'admin', 'user'] });

// objectives has its own shape (perspective/description/divisi), so it gets
// dedicated handlers instead of the generic name-only createCrudRoutes helper.
router.get('/objectives', authenticateToken, authorizeRole('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM objectives ORDER BY created_at ASC');
    res.json(rows);
  } catch (error) {
    console.error('Get objectives error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/objectives', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { name, perspective, description, divisi } = req.body;
    const id = 'obj_' + Date.now();
    await db.query(
      'INSERT INTO objectives (id, name, perspective, description, divisi) VALUES (?, ?, ?, ?, ?)',
      [id, name, perspective || '', description || '', divisi || '']
    );
    res.status(201).json({ id, name, perspective, description, divisi });
  } catch (error) {
    console.error('Create objective error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.put('/objectives/:id', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { name, perspective, description, divisi } = req.body;
    await db.query(
      'UPDATE objectives SET name = ?, perspective = ?, description = ?, divisi = ? WHERE id = ?',
      [name, perspective || '', description || '', divisi || '', req.params.id]
    );
    res.json({ id: req.params.id, name, perspective, description, divisi });
  } catch (error) {
    console.error('Update objective error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.delete('/objectives/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    await db.query('DELETE FROM objectives WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Delete objective error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/strategies', authenticateToken, authorizeRole('superadmin', 'admin', 'user'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.*, o.name as objective_name, o.divisi as objective_divisi
      FROM strategies s
      LEFT JOIN objectives o ON s.objective_id = o.id
      ORDER BY s.id ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Get strategies error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/strategies', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { objective_id, name, perspective, unit, description, formula } = req.body;
    const id = 'str_' + Date.now();
    await db.query(
      'INSERT INTO strategies (id, objective_id, name, perspective, unit, description, formula) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, objective_id, name, perspective, unit || '%', description || '', formula || '']
    );
    res.status(201).json({ id, objective_id, name, perspective, unit, description, formula });
  } catch (error) {
    console.error('Create strategy error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.put('/strategies/:id', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { objective_id, name, perspective, unit, description, formula } = req.body;
    await db.query(
      'UPDATE strategies SET objective_id = ?, name = ?, perspective = ?, unit = ?, description = ?, formula = ? WHERE id = ?',
      [objective_id, name, perspective, unit || '%', description || '', formula || '', req.params.id]
    );
    res.json({ id: req.params.id, objective_id, name, perspective, unit, description, formula });
  } catch (error) {
    console.error('Update strategy error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.delete('/strategies/:id', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    await db.query('DELETE FROM strategies WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Delete strategy error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
