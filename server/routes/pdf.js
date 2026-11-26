const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRole = require('../middleware/authorize');

const router = express.Router();

router.post('/generate', authenticateToken, authorizeRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { kpiIds, includeDetails = true } = req.body;

    if (!kpiIds || kpiIds.length === 0) {
      return res.status(400).json({ message: 'KPI IDs diperlukan' });
    }

    const placeholders = kpiIds.map(() => '?').join(',');
    const [kpis] = await db.query(`SELECT * FROM kpis WHERE id IN (${placeholders})`, kpiIds);

    const pdfData = {
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.name,
      watermark: `CONFIDENTIAL - ${req.user.name} - ${new Date().toLocaleDateString('id-ID')}`,
      kpis: kpis.map(kpi => ({
        name: kpi.name,
        perspective: kpi.perspective,
        target: kpi.target,
        actual: kpi.actual,
        weight: kpi.weight,
        status: kpi.status,
        unit_name: kpi.unit_name,
        jabatan: kpi.jabatan,
        achievement: kpi.target > 0 ? ((kpi.actual / kpi.target) * 100).toFixed(2) : '0.00',
        score: kpi.weight * (kpi.target > 0 ? (kpi.actual / kpi.target) : 0)
      }))
    };

    const totalScore = pdfData.kpis.reduce((sum, kpi) => sum + kpi.score, 0);
    pdfData.totalScore = totalScore.toFixed(2);

    res.json({
      success: true,
      data: pdfData,
      message: 'Data PDF berhasil digenerate. Gunakan library jsPDF di frontend untuk render.'
    });
  } catch (error) {
    console.error('PDF generate error:', error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
