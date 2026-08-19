const fs = require('fs');
const path = require('path');

let divisiDataCache = null;
let jsonTemplatesCache = null;

function loadDivisiData() {
  if (divisiDataCache) return divisiDataCache;
  const srcPath = path.join(__dirname, '../generate_kpi_divisi_detail_final.js');
  const src = fs.readFileSync(srcPath, 'utf8');
  const match = src.match(/const divisiData = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error('divisiData tidak ditemukan');
  divisiDataCache = new Function(`return ${match[1]}`)();
  return divisiDataCache;
}

function getDivisiKpisByUnit(unitName) {
  const data = loadDivisiData();
  for (const group of data) {
    if (group.units.includes(unitName)) {
      return group.kpis.map(k => ({
        name: k.k,
        perspective: k.p,
        unit: k.u,
        target: k.t,
        weight: k.w,
        objective: k.o,
      }));
    }
  }
  return null;
}

const GENERIC_TEMPLATES = {
  managerial: [
    { name: 'Pertumbuhan Laba Bersih / Pendapatan', perspective: 'financial', unit: 'currency', target: '', weight: 30 },
    { name: 'Pertumbuhan Dana Pihak Ketiga (DPK)', perspective: 'financial', unit: 'currency', target: '', weight: 30 },
    { name: 'Indeks Kepuasan Nasabah (CSI)', perspective: 'customer', unit: 'percentage', target: '', weight: 20 },
    { name: 'Tingkat Kepatuhan & Zero Fraud', perspective: 'internal_process', unit: 'percentage', target: '', weight: 20 },
  ],
  sales: [
    { name: 'Pencapaian O/S Kredit / Pembiayaan Baru', perspective: 'financial', unit: 'currency', target: '', weight: 40 },
    { name: 'Akuisisi Nasabah Baru', perspective: 'customer', unit: 'number', target: '', weight: 30 },
    { name: 'Penyelesaian NPL / Kredit Bermasalah', perspective: 'financial', unit: 'percentage', target: '', weight: 20 },
    { name: 'Kunjungan / Pipeline Nasabah', perspective: 'internal_process', unit: 'number', target: '', weight: 10 },
  ],
  operational: [
    { name: 'Akurasi Transaksi (Zero Error)', perspective: 'internal_process', unit: 'percentage', target: '', weight: 40 },
    { name: 'SLA Pelayanan Nasabah', perspective: 'customer', unit: 'percentage', target: '', weight: 30 },
    { name: 'Jumlah Transaksi / Dokumen yang Diproses', perspective: 'internal_process', unit: 'number', target: '', weight: 20 },
    { name: 'Jam Pelatihan Kompetensi', perspective: 'learning_growth', unit: 'number', target: '', weight: 10 },
  ],
};

function inferGenericType(jabatan) {
  const j = (jabatan || '').toLowerCase();
  if (j.includes('pemimpin') || j.includes('kepala') || j.includes('direksi') || j.includes('manager') || j.includes('vice president')) {
    return 'managerial';
  }
  if (j.includes('account officer') || j.includes('sales') || j.includes('funding') || j.includes('analis') || j.includes('kredit') || j.includes('relationship')) {
    return 'sales';
  }
  return 'operational';
}

function loadJsonTemplates() {
  if (jsonTemplatesCache) return jsonTemplatesCache;
  const root = path.join(__dirname, '../..');
  const files = {
    kck: 'kpi_kck.json',
    kc: 'kpi_kc.json',
    kcp: 'kpi_kcp.json',
    pelaksana: 'kpi_pelaksana.json',
  };
  jsonTemplatesCache = {};
  for (const [key, file] of Object.entries(files)) {
    const filePath = path.join(root, file);
    if (fs.existsSync(filePath)) {
      jsonTemplatesCache[key] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } else {
      jsonTemplatesCache[key] = [];
    }
  }
  return jsonTemplatesCache;
}

function normalizePerspective(p) {
  if (!p) return 'financial';
  const lower = p.toLowerCase().trim();
  if (lower.includes('finan')) return 'financial';
  if (lower.includes('custom') || lower.includes('pelanggan') || lower.includes('nasabah')) return 'customer';
  if (lower.includes('internal') || lower.includes('process') || lower.includes('proses')) return 'internal_process';
  if (lower.includes('learning') || lower.includes('growth') || lower.includes('culture')) return 'learning_growth';
  return lower.replace(/\s+/g, '_');
}

function matchKcJabatan(jabatan) {
  const j = (jabatan || '').toLowerCase();
  if (j.includes('wakil pemimpin cabang')) return 'Wakil Pemimpin Cabang';
  if (j.includes('pemimpin cabang koordinator')) return null;
  if (j.includes('pemimpin cabang')) return 'Pemimpin Cabang Kelas 1';
  if (j.includes('pemimpin seksi kredit produktif')) return 'Pemimpin Seksi Kredit Produktif & Dana';
  if (j.includes('pemimpin seksi konsumer')) return 'Pemimpin Seksi Konsumer';
  if (j.includes('pemimpin seksi operasional')) return 'Pemimpin Seksi Operasional';
  if (j.includes('pemimpin seksi pelayanan')) return 'Pemimpin Seksi Pelayanan Nasabah';
  if (j.includes('pemimpin unit layanan prioritas')) return 'Pemimpin Unit Layanan Prioritas';
  if (j.includes('pemimpin payment point')) return 'Pemimpin Payment Point';
  if (j.includes('teller payment point')) return 'Teller Payment Point';
  if (j.includes('pemimpin kas mobil')) return 'Pemimpin Kas Mobil';
  if (j.includes('operator kas mobil')) return 'Operator Kas Mobil';
  if (j.includes('head teller')) return 'Head Teller';
  if (j.includes('teller')) return 'Teller';
  if (j.includes('customer service') || j === 'cs') return 'Customer Service';
  if (j.includes('funding sales officer')) return 'Funding Sales Officer';
  if (j.includes('account officer konsumer')) return 'Account Officer Konsumer';
  if (j.includes('account officer') || j === 'ao') return 'Account Officer';
  if (j.includes('srm') || j.includes('relationship manager') || (j.includes('rm') && !j.includes('form'))) return 'SRM/RM/ARM';
  if (j.includes('back office') || j === 'bo') return 'Back Office';
  if (j.includes('professional manager')) return 'Professional Manager';
  if (j.includes('pelaksana')) return 'Pelaksana';
  return null;
}

function matchKcpJabatan(jabatan) {
  const j = (jabatan || '').toLowerCase();
  if (j.includes('pemimpin cabang pembantu') && !j.includes('wakil')) return 'Pemimpin Cabang Pembantu';
  if (j.includes('wakil pemimpin cabang pembantu')) return 'Wakil Pemimpin Cabang Pembantu';
  if (j.includes('seksi bisnis')) return 'Pemimpin Seksi Bisnis';
  if (j.includes('account officer')) return 'Account Officer';
  if (j.includes('funding sales officer')) return 'Funding Sales Officer';
  if (j.includes('seksi pelayanan') || j.includes('operasional')) return 'Pemimpin Seksi Pelayanan & Operasional';
  if (j.includes('teller')) return 'Teller';
  if (j.includes('customer service') || j === 'cs') return 'Customer Service';
  if (j.includes('back office') || j.includes('pelaksana')) return 'Back Office';
  if (j.includes('pemimpin kas mobil')) return 'Pemimpin Kas Mobil';
  return null;
}

function matchKckJabatan(jabatan) {
  const j = (jabatan || '').toLowerCase();
  if (j.includes('pemimpin cabang koordinator')) return 'Pemimpin Cabang Koordinator Kelas 1';
  if (j.includes('wakil pemimpin')) return 'Wakil Pemimpin Cabang Koordinator';
  if (j.includes('professional manager')) return 'Professional Manager';
  if (j.includes('pelaksana')) return 'Pelaksana';
  return null;
}

function findJsonTemplate(levelUnit, jabatan) {
  const templates = loadJsonTemplates();
  let matchedKey = null;
  let jsonKey = null;

  if (levelUnit === 'kc') {
    matchedKey = matchKcJabatan(jabatan);
    jsonKey = 'kc';
  } else if (levelUnit === 'kcp') {
    matchedKey = matchKcpJabatan(jabatan);
    jsonKey = 'kcp';
  } else if (levelUnit === 'kck') {
    matchedKey = matchKckJabatan(jabatan);
    jsonKey = 'kck';
  }

  if (!matchedKey || !jsonKey) return null;

  const data = templates[jsonKey] || [];
  let template = data.find(item => item.jabatan === matchedKey);

  if (!template && (jabatan || '').toLowerCase().includes('pelaksana')) {
    template = templates.pelaksana?.find(item => item.jabatan === 'Pelaksana');
  }

  if (!template) return null;

  return template.kpis.map(k => ({
    name: k.name,
    perspective: normalizePerspective(k.perspective || k.name),
    unit: k.unit || '%',
    target: k.target || '',
    weight: k.weight || 0,
    objective: k.objective || '',
  }));
}

function getTemplateKpis(unitName, jabatan, levelUnit) {
  if (levelUnit === 'divisi') {
    const divisiKpis = getDivisiKpisByUnit(unitName);
    if (divisiKpis) return { source: 'divisi', kpis: divisiKpis };
  }

  const jsonKpis = findJsonTemplate(levelUnit, jabatan);
  if (jsonKpis) return { source: 'json', kpis: jsonKpis };

  const genericType = inferGenericType(jabatan);
  return { source: 'generic', kpis: GENERIC_TEMPLATES[genericType] };
}

function buildKpiRecords(unitName, jabatan, levelUnit) {
  const { source, kpis } = getTemplateKpis(unitName, jabatan, levelUnit);
  return kpis.map(k => ({
    name: k.name,
    perspective: k.perspective,
    unit: k.unit,
    target: k.target || '',
    actual: 0,
    weight: k.weight || 0,
    unit_name: unitName,
    jabatan,
    unit_type: levelUnit === 'divisi' ? 'divisi' : levelUnit,
    status: 'Draft',
    monthly_data: {},
    monthly_target: {},
    objective: k.objective || '',
    description: '',
    formula: '',
    _templateSource: source,
  }));
}

module.exports = {
  getTemplateKpis,
  buildKpiRecords,
  getDivisiKpisByUnit,
  loadDivisiData,
};
