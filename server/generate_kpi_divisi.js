const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'kpi_corporate',
});

const SEMUA_DIVISI = [
  'Departemen Hukum',
  'Departemen Marketing Communication',
  'Departemen Perlindungan Konsumen',
  'Divisi Audit Internal',
  'Divisi Corporate Secretary',
  'Divisi Credit Risk',
  'Divisi Digital Banking',
  'Divisi Funding & Wealth Management',
  'Divisi Human Capital',
  'Divisi Kepatuhan',
  'Divisi Keuangan',
  'Divisi Kredit Konsumer',
  'Divisi Manajemen Risiko',
  'Divisi Operasional',
  'Divisi Penyelamatan Kredit',
  'Divisi Perencanaan Strategis',
  'Divisi SME & Commercial',
  'Divisi Teknologi Informasi',
  'Divisi Treasury',
  'Divisi Umum',
  'UKK Comercial Business Center',
  'UKK Internal Control over Financial Report',
  'Unit Anti Fraud',
  'Unit Audit Internal Syariah',
  'Unit Keamanan dan Ketahan Siber',
  'Unit Kepatuhan Syariah',
  'Unit Manajemen Risiko Syariah',
  'Unit Pengendalian Gratifikasi'
];

const data = [
  // FINANCIAL
  {
    perspective: 'financial',
    obj: 'F1. Mengoptimalkan Laba Bersih dan Tingkat Pengembalian Aset Secara Konsisten',
    divisi: ['Divisi Keuangan'],
    strategies: [
      { name: 'F1.1. Rp Laba Bersih', unit: 'Rp', weight: 15, target: '100% RBB', desc: 'Mengukur pencapaian laba bersih konsolidasi bank sesuai Rencana Bisnis Bank (RBB).', formula: 'Laba Kotor - (Pajak + Pencadangan)' },
      { name: 'F1.2. % Rasio Pengembalian Ekuitas (ROE)', unit: '%', weight: 15, target: '>= 15%', desc: '', formula: '' }
    ]
  },
  {
    perspective: 'financial',
    obj: 'F2. Mengoptimalkan Pertumbuhan Pendapatan Bunga dan Non-Bunga Secara Berkelanjutan',
    divisi: ['Divisi Keuangan', 'Divisi Treasury'],
    strategies: [
      { name: 'F2.1 Net Interest Margin (NIM)', unit: '%', weight: 10, target: '>= 5%', desc: '', formula: '' },
      { name: 'F2.2 Rp Total Pendapatan Operasional', unit: 'Rp', weight: 10, target: '100% RBB', desc: '', formula: '' }
    ]
  },
  {
    perspective: 'financial',
    obj: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan',
    divisi: SEMUA_DIVISI,
    strategies: [
      { name: 'F3.1. % Rasio Biaya Terhadap Pendapatan (Cost to Income Ratio / CIR)', unit: '%', weight: 10, target: '<= 75%', desc: 'Mengukur tingkat efisiensi penggunaan anggaran operasional (OPEX) di masing-masing divisi.', formula: '(Realisasi Anggaran / Pagu Anggaran) x 100%' }
    ]
  },
  {
    perspective: 'financial',
    obj: 'F4. Menjaga Kecukupan Modal dan Likuiditas Pada Level Yang Sehat Sesuai Ketentuan Regulator',
    divisi: ['Divisi Treasury', 'Divisi Keuangan'],
    strategies: [
      { name: 'F4.1 % Rasio Kecukupan Modal (Capital Adequacy Ratio/CAR)', unit: '%', weight: 10, target: '>= 15%', desc: '', formula: '' },
      { name: 'F4.2 % Rasio Likuiditas Jangka Pendek (Liquidity Coverage Ratio/LCR)', unit: '%', weight: 15, target: '>= 100%', desc: 'Mengukur kemampuan bank memenuhi kewajiban jangka pendek dengan aset likuid berkualitas tinggi.', formula: '(High Quality Liquid Assets / Total Net Cash Outflows) x 100%' }
    ]
  },
  {
    perspective: 'financial',
    obj: 'F5. Meningkatkan Pertumbuhan Dana Pihak Ketiga (DPK) Secara Berkelanjutan dan Berkualitas',
    divisi: ['Divisi Funding & Wealth Management'],
    strategies: [
      { name: 'F5.1 % Pertumbuhan O/S DPK', unit: '%', weight: 20, target: '>= 10%', desc: 'Mengukur total penghimpunan Dana Pihak Ketiga (Giro, Tabungan, Deposito) secara korporasi.', formula: '(O/S DPK Saat Ini - O/S DPK Bulan Lalu) / O/S DPK Bulan Lalu * 100%' }
    ]
  },
  {
    perspective: 'financial',
    obj: 'F6. Meminimalkan Potensi Kerugian Finansial Akibat Pelanggaran Kepatuhan',
    divisi: ['Divisi Manajemen Risiko', 'Divisi Kepatuhan'],
    strategies: [
      { name: 'F6.1 Rp Nilai Kerugian Aktual Akibat Pelanggaran Kepatuhan / (Actual Loss from Compliance Case)', unit: 'Rp', weight: 10, target: '0', desc: 'Nilai kerugian aktual akibat fraud, denda regulator, atau kegagalan operasional.', formula: 'Total Rupiah kerugian aktual pada periode berjalan' }
    ]
  },

  // CUSTOMER
  {
    perspective: 'customer',
    obj: 'C1. Meningkatkan Pangsa Pasar Kredit dan Dana Pihak Ketiga di Wilayah Operasional',
    divisi: ['Divisi SME & Commercial', 'Divisi Kredit Konsumer', 'Divisi Funding & Wealth Management'],
    strategies: [
      { name: 'C1.1 % Market Share Kredit', unit: '%', weight: 10, target: '>= 5%', desc: '', formula: '' },
      { name: 'C1.2 % Market Share Pendanaan', unit: '%', weight: 10, target: '>= 5%', desc: '', formula: '' }
    ]
  },
  {
    perspective: 'customer',
    obj: 'C2. Meningkatkan Jumlah Nasabah Baru dan Mempertahankan Nasabah Existing Secara Berkelanjutan',
    divisi: ['Divisi SME & Commercial', 'Divisi Kredit Konsumer', 'Divisi Funding & Wealth Management'],
    strategies: [
      { name: 'C2.1 # NOA Akuisisi Kredit & Pembiayaan (NOA Baru)', unit: 'Angka', weight: 10, target: '100% Target', desc: '', formula: '' },
      { name: 'C2.2 . # NOA Akuisisi Dana Pihak Ketiga (NOA Baru)', unit: 'Angka', weight: 10, target: '100% Target', desc: '', formula: '' }
    ]
  },
  {
    perspective: 'customer',
    obj: 'C3. Meningkatkan Proporsi Dana Murah (CASA) Dalam Struktur Dana Pihak Ketiga',
    divisi: ['Divisi Funding & Wealth Management'],
    strategies: [
      { name: 'C3.1 % Rasio Dana Murah (CASA Ratio)', unit: '%', weight: 10, target: '>= 60%', desc: '', formula: '' }
    ]
  },
  {
    perspective: 'customer',
    obj: 'C4. Mengoptimalkan Kontribusi Bisnis Syariah Dalam Portofolio Pembiayaan dan Pendanaan',
    divisi: ['Unit Kepatuhan Syariah', 'Unit Manajemen Risiko Syariah', 'Unit Audit Internal Syariah'], 
    strategies: [
      { name: 'C4.1 Rp O/S Pembiayaan Syariah/DBLM', unit: 'Rp', weight: 10, target: '100% Target', desc: '', formula: '' },
      { name: 'C4.2 Rp O/S Dana Pihak Ketiga/DBLM', unit: 'Rp', weight: 10, target: '100% Target', desc: '', formula: '' }
    ]
  },
  {
    perspective: 'customer',
    obj: 'C5. Meningkatkan Penggunaan Layanan Digital Oleh Nasabah Secara Aktif',
    divisi: ['Divisi Digital Banking'],
    strategies: [
      { name: 'C5.1 % Pertumbuhan Pengguna Layanan Digital (Mobile Banking Bank Sumut dan Merchant)', unit: '%', weight: 15, target: '>= 20%', desc: 'Mengukur persentase kenaikan volume transaksi nasabah menggunakan layanan Mobile Banking.', formula: '(Volume Trx Saat Ini - Volume Trx Lalu) / Volume Trx Lalu x 100%' },
      { name: 'C5.2 Rp Fee Income Digital', unit: 'Rp', weight: 15, target: '100% Target', desc: 'Total pendapatan non-bunga yang dihasilkan dari ekosistem digital dan merchant.', formula: 'Total akumulasi FBI Digital' }
    ]
  },
  {
    perspective: 'customer',
    obj: 'C6. Meningkatkan Tingkat Kepuasan dan Loyalitas Pelanggan Berbasis Kualitas Layanan',
    divisi: ['Divisi Corporate Secretary'],
    strategies: [
      { name: 'C6.1 # Indeks Kepuasan Pelanggan / NPS (Net Promoter Score)', unit: 'Skor', weight: 10, target: '>= 75', desc: 'Indeks loyalitas dan kepuasan nasabah terhadap layanan bank secara keseluruhan.', formula: '% Promoters - % Detractors' }
    ]
  },
  {
    perspective: 'customer',
    obj: 'C7. Meningkatkan Tingkat Pengenalan dan Persepsi Positif Masyarakat Terhadap Bank',
    divisi: ['Departemen Marketing Communication'],
    strategies: [
      { name: 'C7.1 # Indeks Brand Awareness Masyarakat (Top of Mind)', unit: 'Skor', weight: 10, target: '>= 80', desc: 'Tingkat Top of Mind masyarakat terhadap Bank Sumut berdasarkan survei eksternal.', formula: 'Hasil skor survei Brand Awareness independen' }
    ]
  },

  // INTERNAL PROCESS
  {
    perspective: 'internal_process',
    obj: 'B1. Meningkatkan Pertumbuhan Kredit Dengan Menjaga Kualitas Aset Dan Likuiditas',
    divisi: ['Divisi Kredit Konsumer', 'Divisi SME & Commercial'],
    strategies: [
      { name: 'B1.1 % Pertumbuhan O/S Total Kredit.', unit: '%', weight: 10, target: '>= 10%', desc: '', formula: '' },
      { name: 'B1.2 % Pertumbuhan Kredit UMKM', unit: '%', weight: 10, target: '>= 15%', desc: '', formula: '' }
    ]
  },
  {
    perspective: 'internal_process',
    obj: 'B2. Meningkatkan Efektivitas Recovery Kredit Bermasalah',
    divisi: ['Divisi Penyelamatan Kredit'],
    strategies: [
      { name: 'B2.1 % Recovery Rate', unit: '%', weight: 20, target: '>= 80%', desc: 'Tingkat keberhasilan penagihan atau penyelamatan atas kredit yang telah dihapus buku (Write-off) atau macet.', formula: '(Total Realisasi Penagihan / Total Target Recovery) x 100%' }
    ]
  },
  {
    perspective: 'internal_process',
    obj: 'B3. Menurunkan Rasio Kredit Bermasalah Dan Meningkatkan Penyelesaian Kredit Bermasalah',
    divisi: ['Divisi Kredit Konsumer', 'Divisi SME & Commercial'],
    strategies: [
      { name: 'B3.1 % Rasio NPL/ NPF Gross', unit: '%', weight: 10, target: '<= 2.5%', desc: 'Menjaga kualitas kredit agar rasio Non-Performing Loan tetap di bawah batas toleransi.', formula: '(Total NPL / Total O/S Kredit) x 100%' },
      { name: 'B3.2 % O/S Kredit Kol.1 yang direalisasikan selama <1 Tahun', unit: '%', weight: 10, target: '>= 90%', desc: '', formula: '' }
    ]
  },
  {
    perspective: 'internal_process',
    obj: 'B4. Meningkatkan Implementasi Inisiatif Produk dan Layanan Sesuai Kebutuhan Pasar',
    divisi: ['Divisi Digital Banking', 'Divisi Perencanaan Strategis'],
    strategies: [
      { name: 'B4.1 % Implementasi Strategi Inisiatif Terkait Produk/layanan.', unit: 'Angka', weight: 10, target: '100% Target', desc: '', formula: '' }
    ]
  },
  {
    perspective: 'internal_process',
    obj: 'B5. Mengoptimalkan Kualitas Perencanaan Strategis Perusahaan',
    divisi: ['Divisi Perencanaan Strategis'],
    strategies: [
      { name: 'B5.1 Realisasi Program Kerja Strategic Sesuai Timeline (Strategic Initiative On Track)', unit: '%', weight: 15, target: '100%', desc: '', formula: '' }
    ]
  },
  {
    perspective: 'internal_process',
    obj: 'B6. Meningkatkan Implementasi Digitalisasi Proses Operasional Secara end-to-end',
    divisi: ['Divisi Teknologi Informasi'],
    strategies: [
      { name: 'B6.1 # Implementasi Peningkatan Digital Channel', unit: 'Angka', weight: 15, target: '100% Target', desc: '', formula: '' }
    ]
  },
  {
    perspective: 'internal_process',
    obj: 'B7. Meningkatkan Penyelesaian Tindak Lanjut Atas Temuan Audit Secara Tepat Waktu',
    divisi: SEMUA_DIVISI,
    strategies: [
      { name: 'B7.1 % Penyelesaian Tindak Lanjut Temuan', unit: '%', weight: 15, target: '100%', desc: 'Tingkat penyelesaian temuan audit (internal maupun regulator) sesuai batas waktu yang ditetapkan.', formula: '(Temuan Diselesaikan / Total Temuan Jatuh Tempo) x 100%' }
    ]
  },
  {
    perspective: 'internal_process',
    obj: 'B8. Memastikan Tingkat Kesehatan Bank Melalui Penguatan Manajemen Risiko dan Kepatuhan',
    divisi: ['Divisi Manajemen Risiko', 'Divisi Kepatuhan'],
    strategies: [
      { name: 'B8.1 # Tingkat Kesehatan Bank', unit: 'Skor', weight: 15, target: 'PK-2', desc: '', formula: '' }
    ]
  },

  // LEARNING & GROWTH
  {
    perspective: 'learning_growth',
    obj: 'L1. Meningkatkan Tingkat Keterlibatan Dan Kepuasan Karyawan',
    divisi: ['Divisi Human Capital'],
    strategies: [
      { name: 'L1.1 # Employee Engagement Index', unit: 'Skor', weight: 15, target: '>= 85', desc: 'Mengukur tingkat keterikatan dan motivasi karyawan terhadap perusahaan melalui survei tahunan.', formula: 'Skor hasil survei EEI pihak ketiga' }
    ]
  },
  {
    perspective: 'learning_growth',
    obj: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi',
    divisi: ['Divisi Human Capital'],
    strategies: [
      { name: 'L2.1 # Digital Skill Index', unit: 'Skor', weight: 5, target: '>= 75', desc: '', formula: '' },
      { name: 'L2.2 # Training Mandays', unit: 'Angka', weight: 5, target: '>= 5', desc: 'Memastikan setiap karyawan mendapatkan rata-rata hari pelatihan yang memadai dalam setahun.', formula: 'Total Hari Pelatihan Karyawan / Jumlah Karyawan' },
      { name: 'L2.3 % Karyawan Kategori Talent', unit: '%', weight: 5, target: '>= 10%', desc: '', formula: '' },
      { name: 'L2.4 Rp. EBITDA Per Karyawan', unit: 'Rp', weight: 5, target: '>= Target RBB', desc: '', formula: '' }
    ]
  },
  {
    perspective: 'learning_growth',
    obj: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan',
    divisi: SEMUA_DIVISI,
    strategies: [
      { name: 'L3.1 # Culture Implementation Index', unit: 'Skor', weight: 10, target: '>= 80', desc: 'Tingkat keikutsertaan karyawan di divisi tersebut dalam program internalisasi budaya perusahaan.', formula: 'Hasil Assessment' }
    ]
  }
];

async function seed() {
  try {
    for (const item of data) {
      for (const divisiName of item.divisi) {
        for (const strat of item.strategies) {
          // Cek apakah KPI sudah ada di divisi tersebut
          const [existing] = await pool.query('SELECT id FROM kpis WHERE unit_name = ? AND name = ? AND objective = ?', [divisiName, strat.name, item.obj]);
          
          if (existing.length === 0) {
            const kpiId = crypto.randomUUID();
            await pool.query(
              `INSERT INTO kpis 
              (id, name, perspective, unit, target, actual, weight, unit_name, jabatan, unit_type, status, description, formula, objective) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                kpiId, 
                strat.name, 
                item.perspective, 
                strat.unit, 
                strat.target, 
                0, 
                strat.weight, 
                divisiName, 
                '', 
                'divisi', 
                'Draft', 
                strat.desc, 
                strat.formula, 
                item.obj
              ]
            );
            console.log(`[+] Disisipkan KPI: ${strat.name} untuk ${divisiName}`);
          }
        }
      }
    }
    console.log('\n✅ Proses Inject KPI Unit untuk seluruh Divisi berhasil diselesaikan!');
  } catch (error) {
    console.error('Error saat menyisipkan data:', error);
  } finally {
    pool.end();
  }
}

seed();