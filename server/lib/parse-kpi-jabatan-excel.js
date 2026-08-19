const XLSX = require('xlsx');
const path = require('path');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

const PERSPECTIVE_ORDER = ['financial', 'customer', 'internal_process', 'learning_growth'];

function normalizePerspective(perspective) {
  const v = (perspective || '').toString().trim().toLowerCase();
  if (v.includes('financial') || v.includes('finansial')) return 'financial';
  if (v.includes('customer')) return 'customer';
  if (v.includes('internal') || v.includes('bisnis') || v.includes('proses')) return 'internal_process';
  if (v.includes('learning') || v.includes('growth') || v.includes('people')) return 'learning_growth';
  return 'financial';
}

function normalizeUnit(raw) {
  const v = (raw || '').toString().trim().toLowerCase();
  if (v.includes('juta') || v.includes('rupiah')) return 'currency';
  if (v.includes('persen') || v === '%' || v.includes('percent')) return 'percentage';
  if (v.includes('indeks') || v.includes('skor')) return 'score';
  return 'number';
}

function inferPolarity(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('npl') || n.includes('bopo') || n.includes('cost of') || n.includes('rekening tutup')) return 'minimize';
  if (n.includes('kesalahan') || n.includes('biaya atk') || n.includes('biaya listrik')) return 'minimize';
  if (n.includes('cost')) return 'minimize';
  return 'maximize';
}

function cellText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function findHeaderMeta(rows) {
  const candidates = [];
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i] || [];
    const cells = row.map((c) => cellText(c).toLowerCase());
    const jabIdx = cells.findIndex((c) => c === 'jabatan');
    const indIdx = cells.findIndex((c) => c.includes('indikator'));
    const bobotIdx = cells.findIndex((c) => c.includes('bobot'));
    if (jabIdx < 0 || indIdx < 0 || bobotIdx < 0) continue;
    const perspIdx = cells.findIndex((c) => c.includes('perspektif'));
    const unitIdx = cells.findIndex((c) => c.includes('ukuran'));
    let targetIdx = cells.findIndex((c) => c.includes('target tahunan'));
    if (targetIdx < 0) targetIdx = cells.findIndex((c) => c === 'target');
    const janIdx = cells.findIndex((c) => c === 'jan');
    candidates.push({
      headerRow: i,
      jabIdx,
      perspIdx: perspIdx >= 0 ? perspIdx : 1,
      nameIdx: indIdx,
      unitIdx: unitIdx >= 0 ? unitIdx : indIdx + 1,
      weightIdx: bobotIdx,
      targetIdx: targetIdx >= 0 ? targetIdx : bobotIdx + 1,
      monthStartIdx: janIdx >= 0 ? janIdx : (targetIdx >= 0 ? targetIdx + 1 : bobotIdx + 2),
      hasMonths: janIdx >= 0,
    });
  }
  if (!candidates.length) return null;
  const withMonths = candidates.filter((c) => c.hasMonths);
  return (withMonths.length ? withMonths[withMonths.length - 1] : candidates[candidates.length - 1]);
}

function isHeaderLikeJabatan(jabatan) {
  const j = cellText(jabatan).toLowerCase();
  return !j || j === 'jabatan' || j.includes('indikator') || j.includes('key performance');
}

function parseNumericValue(raw, unit) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    if (unit === 'percentage' && Math.abs(raw) <= 1.5) return Math.round(raw * 10000) / 100;
    return raw;
  }
  const text = String(raw).trim();
  const match = text.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const num = parseFloat(match[0].replace(',', '.'));
  if (Number.isNaN(num)) return null;
  if (unit === 'percentage' && Math.abs(num) <= 1.5) return Math.round(num * 10000) / 100;
  return num;
}

function cleanName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim();
}

/**
 * Parse sheet KPI jabatan (format: baris 0-1 header, data dari baris 2).
 * Kolom bulan: Realisasi, Target, Nilai (Nilai diabaikan — dihitung app).
 * Mendukung banyak jabatan dalam 1 sheet → groups[].
 */
function parseKpiJabatanExcel(filePath) {
  const abs = path.resolve(filePath);
  const wb = XLSX.readFile(abs);
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
  const header = findHeaderMeta(rows);

  const nameIdx = header ? header.nameIdx : 2;
  const unitIdx = header ? header.unitIdx : 3;
  const weightIdx = header ? header.weightIdx : 4;
  const targetIdx = header ? header.targetIdx : 5;
  const perspIdx = header ? header.perspIdx : 1;
  const jabIdx = header ? header.jabIdx : 0;
  const monthStartIdx = header ? header.monthStartIdx : 6;
  const startRow = header ? header.headerRow + 2 : 2;

  let jabatan = '';
  let currentPerspective = '';
  const groupMap = new Map();

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.some((cell) => cell !== null && cell !== '')) continue;

    if (row[jabIdx]) jabatan = cellText(row[jabIdx]);
    if (row[perspIdx]) currentPerspective = cellText(row[perspIdx]);
    if (isHeaderLikeJabatan(jabatan)) continue;

    const name = cleanName(row[nameIdx]);
    if (!name || name.toLowerCase().includes('key performance') || !jabatan) continue;

    const unit = normalizeUnit(row[unitIdx]);
    const weight = Number(row[weightIdx]) || 0;
    const annualTarget = parseNumericValue(row[targetIdx], unit);

    const monthly_data = {};
    const monthly_target = {};

    MONTHS.forEach((month, mi) => {
      const base = monthStartIdx + mi * 3;
      const real = parseNumericValue(row[base], unit);
      const tgt = parseNumericValue(row[base + 1], unit);
      if (real !== null) monthly_data[month] = real;
      if (tgt !== null) monthly_target[month] = tgt;
    });

    if (!groupMap.has(jabatan)) groupMap.set(jabatan, []);
    groupMap.get(jabatan).push({
      name,
      perspective: normalizePerspective(currentPerspective || row[perspIdx]),
      unit,
      weight,
      target: annualTarget ?? 0,
      polarity: inferPolarity(name),
      monthly_data,
      monthly_target,
    });
  }

  const groups = [...groupMap.entries()].map(([j, list]) => {
    const kpis = [...list].sort((a, b) => {
      const pA = PERSPECTIVE_ORDER.indexOf(a.perspective);
      const pB = PERSPECTIVE_ORDER.indexOf(b.perspective);
      if (pA !== pB) return pA - pB;
      return 0;
    });
    return { jabatan: j, kpis };
  });

  // Backward compatible: single-group shape (jabatan + kpis = first/last group)
  const primary = groups[groups.length - 1] || { jabatan: '', kpis: [] };
  return {
    jabatan: primary.jabatan,
    kpis: primary.kpis,
    groups,
    sheetName,
  };
}

/** Jabatan generik di Excel → kelas / varian di pegawai */
function resolveJabatanTargets(jabatanFromExcel) {
  const j = (jabatanFromExcel || '').trim();
  if (j === 'Pemimpin Cabang') {
    return [
      'Pemimpin Cabang Kelas 1',
      'Pemimpin Cabang Kelas 2',
      'Pemimpin Cabang Kelas 3',
    ];
  }
  if (j === 'Wakil Pemimpin Cabang') {
    return [
      'Wakil Pemimpin Cabang Kelas 1',
      'Wakil Pemimpin Cabang Kelas 2',
      'Wakil Pemimpin Cabang Kelas 3',
    ];
  }
  if (j === 'Pemimpin Seksi Konsumer') {
    // Varian di master pegawai (Kelas / & Dana / Koordinator / Pj.)
    return [
      'Pemimpin Seksi Konsumer Cabang Kelas 1',
      'Pemimpin Seksi Konsumer Cabang Kelas 2',
      'Pemimpin Seksi Konsumer Cabang Kelas 3',
      'Pemimpin Seksi Konsumer & Dana Cabang Kelas 1',
      'Pemimpin Seksi Konsumer & Dana Cabang Kelas 2',
      'Pemimpin Seksi Konsumer & Dana Cabang Kelas 3',
      'Pemimpin Seksi Konsumer Cabang Koordinator Kelas 1',
      'Pemimpin Seksi Konsumer Cabang Koordinator Kelas 2',
      'Pemimpin Seksi Konsumer & Dana Cabang Koordinator Kelas 1',
      'Pemimpin Seksi Konsumer & Dana Cabang Koordinator Kelas 2',
      'Pj. Pemimpin Seksi Konsumer Cabang Kelas 3',
      'Pj.Pemimpin Seksi Konsumer & Dana Cabang Kelas 2',
    ];
  }
  if (j === 'Pemimpin Seksi Pelayanan') {
    return [
      'Pemimpin Seksi Pelayanan Cabang Kelas 1',
      'Pemimpin Seksi Pelayanan Cabang Kelas 2',
      'Pemimpin Seksi Pelayanan Cabang Kelas 3',
      'Pemimpin Seksi Pelayanan Cabang Koordinator Kelas 1',
      'Pemimpin Seksi Pelayanan Cabang Koordinator Kelas 2',
      'Pemimpin Seksi Pelayanan & Operasional Cabang Pembantu Kelas 1',
      'Pemimpin Seksi Pelayanan & Operasional Cabang Pembantu Kelas 2',
      'Pemimpin Seksi Pelayanan Keuangan',
      'Pemimpin Seksi Pelayanan Lembaga',
      'Pemimpin Seksi Pelayanan Nasabah',
    ];
  }
  if (j === 'Relationship Manager') {
    return [
      'Relationship Manager Cabang Kelas 1',
      'Relationship Manager Cabang Kelas 2',
      'Relationship Manager Cabang Kelas 3',
      'Relationship Manager Cabang Koordinator Kelas 1',
      'Relationship Manager Cabang Koordinator Kelas 2',
      'Relationship Manager Kredit Komersial',
      'Relationship Manager Kredit Korporasi',
    ];
  }
  if (j === 'Account Officer') {
    return ['Account Officer'];
  }
  if (j === 'Pemimpin Cabang Pembantu') {
    return ['Pemimpin Cabang Pembantu'];
  }
  if (j === 'Wakil Pemimpin Cabang Pembantu') {
    return ['Wakil Pemimpin Cabang Pembantu'];
  }
  return [j];
}

module.exports = {
  parseKpiJabatanExcel,
  resolveJabatanTargets,
  MONTHS,
};
