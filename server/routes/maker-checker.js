const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorize');
const { auditMiddleware } = require('../middleware/audit');

const router = express.Router();

router.post('/request', authenticateToken, auditMiddleware('REQUEST_MAKER_CHECKER'), async (req, res) => {
  try {
    const { action_type, target_id, details, reason } = req.body;

    const id = `mc_${Date.now()}`;
    await db.query(
      `INSERT INTO maker_checker (id, maker_id, action_type, target_id, details, reason, status, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [id, req.user.id, action_type, target_id || null, JSON.stringify(details), reason]
    );

    res.status(201).json({ id, message: 'Permintaan berhasil dibuat, menunggu approval checker' });
  } catch (error) {
    console.error('Maker-checker request error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/pending', authenticateToken, authorizeRole('superadmin'), async (req, res) => {
  try {
    const [requests] = await db.query(
      `SELECT mc.*, u.name as maker_name, u.username as maker_username 
       FROM maker_checker mc 
       JOIN users u ON mc.maker_id = u.id 
       WHERE mc.status = 'pending' 
       ORDER BY mc.created_at ASC`
    );

    res.json(requests.map(r => ({
      ...r,
      details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details
    })));
  } catch (error) {
    console.error('Get pending requests error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/approve/:id', authenticateToken, authorizeRole('superadmin'), auditMiddleware('APPROVE_MAKER_CHECKER'), async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const [requests] = await db.query('SELECT * FROM maker_checker WHERE id = ?', [id]);
    if (requests.length === 0) {
      return res.status(404).json({ message: 'Permintaan tidak ditemukan' });
    }

    await db.query(
      `UPDATE maker_checker SET status = 'approved', checker_id = ?, checker_comments = ?, approved_at = NOW() WHERE id = ?`,
      [req.user.id, comments || null, id]
    );

    res.json({ message: 'Permintaan berhasil disetujui' });
  } catch (error) {
    console.error('Approve maker-checker error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.post('/reject/:id', authenticateToken, authorizeRole('superadmin'), auditMiddleware('REJECT_MAKER_CHECKER'), async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    if (!comments) {
      return res.status(400).json({ message: 'Alasan penolakan wajib diisi' });
    }

    await db.query(
      `UPDATE maker_checker SET status = 'rejected', checker_id = ?, checker_comments = ?, approved_at = NOW() WHERE id = ?`,
      [req.user.id, comments, id]
    );

    res.json({ message: 'Permintaan ditolak' });
  } catch (error) {
    console.error('Reject maker-checker error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

router.get('/history', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const [requests] = await db.query(
      `SELECT mc.*, 
        maker.name as maker_name, 
        checker.name as checker_name 
       FROM maker_checker mc 
       JOIN users maker ON mc.maker_id = maker.id 
       LEFT JOIN users checker ON mc.checker_id = checker.id 
       ORDER BY mc.created_at DESC 
       LIMIT 100`
    );

    res.json(requests.map(r => ({
      ...r,
      details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details
    })));
  } catch (error) {
    console.error('Get maker-checker history error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
