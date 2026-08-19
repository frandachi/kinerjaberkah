const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'kpi_corporate',
});

const SEMUA_DIVISI = 'Departemen Hukum, Departemen Marketing Communication, Departemen Perlindungan Konsumen, Divisi Audit Internal, Divisi Corporate Secretary, Divisi Credit Risk, Divisi Digital Banking, Divisi Funding & Wealth Management, Divisi Human Capital, Divisi Keuangan, Divisi Kepatuhan, Divisi Kredit Konsumer, Divisi Manajemen Risiko, Divisi Operasional, Divisi Penyelamatan Kredit, Divisi Perencanaan Strategis, Divisi SME & Commercial, Divisi Teknologi Informasi, Divisi Treasury, Divisi Umum, UKK Comercial Business Center, UKK Internal Control over Financial Report, Unit Anti Fraud, Unit Audit Internal Syariah, Unit Keamanan dan Ketahan Siber, Unit Kepatuhan Syariah, Unit Manajemen Risiko Syariah, Unit Pengendalian Gratifikasi, Unit Usaha Syariah';

const data = [
  // FINANCIAL
  {
    perspective: 'financial',
    obj: 'F1. Mengoptimalkan Laba Bersih dan Tingkat Pengembalian Aset Secara Konsisten',
    divisi: 'Divisi Keuangan',
    strategies: [
      { name: 'Pencapaian Laba Bersih Bank', unit: 'Rp', weight: 15, target: '100% RBB', desc: 'Mengukur pencapaian laba bersih konsolidasi bank sesuai Rencana Bisnis Bank (RBB).', formula: 'Laba Kotor - (Pajak + Pencadangan)' }
    ]
  },
  {
    perspective: 'financial',
    obj: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan',
    divisi: SEMUA_DIVISI,
    strategies: [
      { name: 'Efisiensi Penggunaan Anggaran Divisi', unit: '%', weight: 10, target: '<= 100%', desc: 'Mengukur tingkat efisiensi penggunaan anggaran operasional (OPEX) di masing-masing divisi.', formula: '(Realisasi Anggaran / Pagu Anggaran) x 100%' }
    ]
  },
  {
    perspective: 'financial',
    obj: 'F5. Meningkatkan Pertumbuhan Dana Pihak Ketiga (DPK) Secara Berkelanjutan dan Berkualitas',
    divisi: 'Divisi Funding & Wealth Management',
    strategies: [
      { name: 'Pencapaian Target DPK', unit: 'Rp', weight: 20, target: '100% RBB', desc: 'Mengukur total penghimpunan Dana Pihak Ketiga (Giro, Tabungan, Deposito) secara korporasi.', formula: 'Total O/S DPK Posisi Akhir Bulan' }
    ]
  },
  {
    perspective: 'financial',
    obj: 'F4. Menjaga Kecukupan Modal dan Likuiditas Pada Level Yang Sehat Sesuai Ketentuan Regulator',
    divisi: 'Divisi Treasury',
    strategies: [
      { name: 'Liquidity Coverage Ratio (LCR)', unit: '%', weight: 15, target: '>= 100%', desc: 'Mengukur kemampuan bank memenuhi kewajiban jangka pendek dengan aset likuid berkualitas tinggi.', formula: '(High Quality Liquid Assets / Total Net Cash Outflows) x 100%' }
    ]
  },
  {
    perspective: 'financial',
    obj: 'F6. Meminimalkan Potensi Kerugian Finansial Akibat Pelanggaran Kepatuhan',
    divisi: 'Divisi Manajemen Risiko',
    strategies: [
      { name: 'Minimalisasi Kerugian Finansial (Loss Event)', unit: 'Rp', weight: 10, target: '0', desc: 'Nilai kerugian aktual akibat fraud, denda regulator, atau kegagalan operasional.', formula: 'Total Rupiah kerugian aktual pada periode berjalan' }
    ]
  },

  // CUSTOMER
  {
    perspective: 'customer',
    obj: 'C1. Meningkatkan Pangsa Pasar Kredit dan Dana Pihak Ketiga di Wilayah Operasional',
    divisi: 'Divisi SME & Commercial, Divisi Kredit Konsumer',
    strategies: [
      { name: 'Pertumbuhan NOA & O/S Kredit Produktif', unit: '%', weight: 15, target: '>= 15%', desc: 'Peningkatan jumlah rekening dan nominal kredit untuk segmen komersial & SME.', formula: '(O/S Bulan Ini - O/S Bulan Lalu) / O/S Bulan Lalu x 100%' }
    ]
  },
  {
    perspective: 'customer',
    obj: 'C5. Meningkatkan Penggunaan Layanan Digital Oleh Nasabah Secara Aktif',
    divisi: 'Divisi Digital Banking',
    strategies: [
      { name: 'Pertumbuhan Transaksi Mobile Banking', unit: '%', weight: 15, target: '>= 20%', desc: 'Mengukur persentase kenaikan volume transaksi nasabah menggunakan layanan Mobile Banking.', formula: '(Volume Trx Saat Ini - Volume Trx Lalu) / Volume Trx Lalu x 100%' },
      { name: 'Fee Based Income Digital', unit: 'Rp', weight: 15, target: '100% Target', desc: 'Total pendapatan non-bunga yang dihasilkan dari ekosistem digital dan merchant.', formula: 'Total akumulasi FBI Digital' }
    ]
  },
  {
    perspective: 'customer',
    obj: 'C6. Meningkatkan Tingkat Kepuasan dan Loyalitas Pelanggan Berbasis Kualitas Layanan',
    divisi: 'Divisi Corporate Secretary',
    strategies: [
      { name: 'Net Promoter Score (NPS)', unit: 'Skor', weight: 10, target: '>= 75', desc: 'Indeks loyalitas dan kepuasan nasabah terhadap layanan bank secara keseluruhan.', formula: '% Promoters - % Detractors' }
    ]
  },
  {
    perspective: 'customer',
    obj: 'C7. Meningkatkan Tingkat Pengenalan dan Persepsi Positif Masyarakat Terhadap Bank',
    divisi: 'Departemen Marketing Communication',
    strategies: [
      { name: 'Indeks Brand Awareness', unit: 'Skor', weight: 10, target: '>= 80', desc: 'Tingkat Top of Mind masyarakat terhadap Bank Sumut berdasarkan survei eksternal.', formula: 'Hasil skor survei Brand Awareness independen' }
    ]
  },

  // INTERNAL PROCESS
  {
    perspective: 'internal_process',
    obj: 'B2. Meningkatkan Efektivitas Recovery Kredit Bermasalah',
    divisi: 'Divisi Penyelamatan Kredit',
    strategies: [
      { name: 'Recovery Rate Kredit Macet', unit: '%', weight: 20, target: '>= 80%', desc: 'Tingkat keberhasilan penagihan atau penyelamatan atas kredit yang telah dihapus buku (Write-off) atau macet.', formula: '(Total Realisasi Penagihan / Total Target Recovery) x 100%' }
    ]
  },
  {
    perspective: 'internal_process',
    obj: 'B3. Menurunkan Rasio Kredit Bermasalah Dan Meningkatkan Penyelesaian Kredit Bermasalah',
    divisi: 'Divisi Kredit Konsumer, Divisi SME & Commercial',
    strategies: [
      { name: 'Rasio NPL Gross', unit: '%', weight: 15, target: '<= 2.5%', desc: 'Menjaga kualitas kredit agar rasio Non-Performing Loan tetap di bawah batas toleransi.', formula: '(Total NPL / Total O/S Kredit) x 100%' }
    ]
  },
  {
    perspective: 'internal_process',
    obj: 'B6. Meningkatkan Implementasi Digitalisasi Proses Operasional Secara end-to-end',
    divisi: 'Divisi Teknologi Informasi',
    strategies: [
      { name: 'System Uptime (SLA)', unit: '%', weight: 15, target: '99.9%', desc: 'Keandalan dan ketersediaan sistem core banking dan layanan channel elektronik.', formula: '(Total Jam Uptime / Total Jam dalam Sebulan) x 100%' }
    ]
  },
  {
    perspective: 'internal_process',
    obj: 'B7. Meningkatkan Penyelesaian Tindak Lanjut Atas Temuan Audit Secara Tepat Waktu',
    divisi: 'Divisi Audit Internal',
    strategies: [
      { name: 'Penyelesaian Temuan Audit', unit: '%', weight: 15, target: '100%', desc: 'Tingkat penyelesaian temuan audit (internal maupun regulator) sesuai batas waktu yang ditetapkan.', formula: '(Temuan Diselesaikan / Total Temuan Jatuh Tempo) x 100%' }
    ]
  },
  {
    perspective: 'internal_process',
    obj: 'B7. Meningkatkan Penyelesaian Tindak Lanjut Atas Temuan Audit Secara Tepat Waktu',
    divisi: SEMUA_DIVISI,
    strategies: [
      { name: 'Zero Major Audit Finding', unit: 'Angka', weight: 10, target: '0', desc: 'Tidak adanya temuan audit berkategori "Major" atau berisiko tinggi di divisi masing-masing.', formula: 'Jumlah temuan major dari SKAI / OJK' }
    ]
  },
  {
    perspective: 'internal_process',
    obj: 'B8. Memastikan Tingkat Kesehatan Bank Melalui Penguatan Manajemen Risiko dan Kepatuhan',
    divisi: 'Divisi Kepatuhan',
    strategies: [
      { name: 'Compliance Maturity Level', unit: 'Skor', weight: 15, target: '>= 4', desc: 'Tingkat kematangan penerapan kepatuhan di seluruh lini bank sesuai standar OJK.', formula: 'Skor Assessment Kepatuhan' }
    ]
  },

  // LEARNING & GROWTH
  {
    perspective: 'learning_growth',
    obj: 'L1. Meningkatkan Tingkat Keterlibatan Dan Kepuasan Karyawan',
    divisi: 'Divisi Human Capital',
    strategies: [
      { name: 'Employee Engagement Index (EEI)', unit: 'Skor', weight: 15, target: '>= 85', desc: 'Mengukur tingkat keterikatan dan motivasi karyawan terhadap perusahaan melalui survei tahunan.', formula: 'Skor hasil survei EEI pihak ketiga' }
    ]
  },
  {
    perspective: 'learning_growth',
    obj: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi',
    divisi: 'Divisi Human Capital',
    strategies: [
      { name: 'Realisasi Training Mandays', unit: 'Angka', weight: 10, target: '>= 5', desc: 'Memastikan setiap karyawan mendapatkan rata-rata hari pelatihan yang memadai dalam setahun.', formula: 'Total Hari Pelatihan Karyawan / Jumlah Karyawan' }
    ]
  },
  {
    perspective: 'learning_growth',
    obj: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan',
    divisi: SEMUA_DIVISI,
    strategies: [
      { name: 'Tingkat Partisipasi Program Budaya (Culture)', unit: '%', weight: 10, target: '100%', desc: 'Tingkat keikutsertaan karyawan di divisi tersebut dalam program internalisasi budaya perusahaan.', formula: '(Karyawan Ikut Serta / Total Karyawan Divisi) x 100%' }
    ]
  }
];

async function seed() {
  try {
    for (const item of data) {
      // Check if objective exists
      const [existingObj] = await pool.query('SELECT id, divisi FROM objectives WHERE name = ? AND perspective = ?', [item.obj, item.perspective]);
      
      let objId;
      if (existingObj.length > 0) {
        objId = existingObj[0].id;
        // Merge divisi if needed
        const existingDivs = existingObj[0].divisi ? existingObj[0].divisi.split(',').map(d => d.trim()) : [];
        const newDivs = item.divisi.split(',').map(d => d.trim());
        const combined = [...new Set([...existingDivs, ...newDivs])].join(', ');
        await pool.query('UPDATE objectives SET divisi = ? WHERE id = ?', [combined, objId]);
      } else {
        objId = crypto.randomUUID();
        await pool.query('INSERT INTO objectives (id, name, perspective, divisi) VALUES (?, ?, ?, ?)', [
          objId, item.obj, item.perspective, item.divisi
        ]);
      }

      for (const strat of item.strategies) {
        // Check if strategy exists
        const [existingStrat] = await pool.query('SELECT id FROM strategies WHERE objective_id = ? AND name = ?', [objId, strat.name]);
        if (existingStrat.length === 0) {
          const stratId = crypto.randomUUID();
          await pool.query(
            'INSERT INTO strategies (id, objective_id, name, perspective, unit, description, formula, weight, target) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [stratId, objId, strat.name, item.perspective, strat.unit, strat.desc, strat.formula, strat.weight, strat.target]
          );
          console.log(`Inserted Strategy: ${strat.name}`);
        }
      }
    }
    console.log('Seeding Divisi KPI completed!');
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    pool.end();
  }
}

seed();