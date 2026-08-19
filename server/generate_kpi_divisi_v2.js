const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'kpi_corporate',
});

const groups = [
  {
    units: ['Divisi Keuangan'],
    kpis: [
      { p: 'financial', o: 'F1. Mengoptimalkan Laba Bersih dan Tingkat Pengembalian Aset Secara Konsisten', k: 'F1.1. Rp Laba Bersih', w: 15, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F2. Mengoptimalkan Pertumbuhan Pendapatan Bunga dan Non-Bunga Secara Berkelanjutan', k: 'F2.1 Net Interest Margin (NIM)', w: 10, u: '%', t: '>= 5%' },
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan', k: 'F3.1. % Rasio Biaya Terhadap Pendapatan (Cost to Income Ratio / CIR)', w: 10, u: '%', t: '<= 75%' },
      { p: 'financial', o: 'F4. Menjaga Kecukupan Modal dan Likuiditas Pada Level Yang Sehat Sesuai Ketentuan Regulator', k: 'F4.1 % Rasio Kecukupan Modal (Capital Adequacy Ratio/CAR)', w: 10, u: '%', t: '>= 15%' },
      { p: 'customer', o: 'C6. Meningkatkan Tingkat Kepuasan dan Loyalitas Pelanggan Berbasis Kualitas Layanan', k: 'C6.1 # Indeks Kepuasan Internal (Internal NPS)', w: 15, u: 'Skor', t: '>= 80' },
      { p: 'internal_process', o: 'B8. Memastikan Tingkat Kesehatan Bank Melalui Penguatan Manajemen Risiko dan Kepatuhan', k: 'B8.1 # Tingkat Kesehatan Bank (TKB)', w: 20, u: 'Skor', t: 'PK-2' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi', k: 'L2.2 # Training Mandays', w: 10, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan', k: 'L3.1 # Culture Implementation Index', w: 10, u: 'Skor', t: '>= 80' },
    ]
  },
  {
    units: ['Divisi Treasury'],
    kpis: [
      { p: 'financial', o: 'F2. Mengoptimalkan Pertumbuhan Pendapatan Bunga dan Non-Bunga Secara Berkelanjutan', k: 'F2.2 Rp Total Pendapatan Operasional', w: 15, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan', k: 'F3.1. % Rasio Biaya Terhadap Pendapatan (Cost to Income Ratio / CIR)', w: 10, u: '%', t: '<= 75%' },
      { p: 'financial', o: 'F4. Menjaga Kecukupan Modal dan Likuiditas Pada Level Yang Sehat Sesuai Ketentuan Regulator', k: 'F4.2 % Rasio Likuiditas Jangka Pendek (Liquidity Coverage Ratio/LCR)', w: 20, u: '%', t: '>= 100%' },
      { p: 'customer', o: 'C6. Meningkatkan Tingkat Kepuasan dan Loyalitas Pelanggan Berbasis Kualitas Layanan', k: 'C6.1 # Indeks Kepuasan Internal (Internal NPS)', w: 15, u: 'Skor', t: '>= 80' },
      { p: 'internal_process', o: 'B8. Memastikan Tingkat Kesehatan Bank Melalui Penguatan Manajemen Risiko dan Kepatuhan', k: 'B8.1 # Tingkat Kesehatan Bank (TKB)', w: 20, u: 'Skor', t: 'PK-2' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi', k: 'L2.2 # Training Mandays', w: 10, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan', k: 'L3.1 # Culture Implementation Index', w: 10, u: 'Skor', t: '>= 80' },
    ]
  },
  {
    units: ['Divisi SME & Commercial', 'Divisi Kredit Konsumer', 'UKK Comercial Business Center'],
    kpis: [
      { p: 'financial', o: 'F2. Mengoptimalkan Pertumbuhan Pendapatan Bunga dan Non-Bunga Secara Berkelanjutan', k: 'F2.2 Rp Total Pendapatan Bunga Kredit', w: 10, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan', k: 'F3.1. % Rasio Biaya Terhadap Pendapatan (Cost to Income Ratio / CIR)', w: 10, u: '%', t: '<= 75%' },
      { p: 'customer', o: 'C1. Meningkatkan Pangsa Pasar Kredit dan Dana Pihak Ketiga di Wilayah Operasional', k: 'C1.1 % Market Share Kredit', w: 10, u: '%', t: '>= 5%' },
      { p: 'customer', o: 'C2. Meningkatkan Jumlah Nasabah Baru dan Mempertahankan Nasabah Existing Secara Berkelanjutan', k: 'C2.1 # NOA Akuisisi Kredit & Pembiayaan', w: 10, u: 'Angka', t: '100%' },
      { p: 'internal_process', o: 'B1. Meningkatkan Pertumbuhan Kredit Dengan Menjaga Kualitas Aset Dan Likuiditas', k: 'B1.1 % Pertumbuhan O/S Total Kredit', w: 20, u: '%', t: '>= 15%' },
      { p: 'internal_process', o: 'B3. Menurunkan Rasio Kredit Bermasalah Dan Meningkatkan Penyelesaian Kredit Bermasalah', k: 'B3.1 % Rasio NPL/ NPF Gross', w: 20, u: '%', t: '<= 2.5%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi', k: 'L2.2 # Training Mandays', w: 10, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan', k: 'L3.1 # Culture Implementation Index', w: 10, u: 'Skor', t: '>= 80' },
    ]
  },
  {
    units: ['Divisi Funding & Wealth Management'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan', k: 'F3.1. % Rasio Biaya Terhadap Pendapatan (Cost to Income Ratio / CIR)', w: 10, u: '%', t: '<= 75%' },
      { p: 'financial', o: 'F5. Meningkatkan Pertumbuhan Dana Pihak Ketiga (DPK) Secara Berkelanjutan dan Berkualitas', k: 'F5.1 % Pertumbuhan O/S DPK', w: 20, u: '%', t: '>= 15%' },
      { p: 'customer', o: 'C1. Meningkatkan Pangsa Pasar Kredit dan Dana Pihak Ketiga di Wilayah Operasional', k: 'C1.2 % Market Share Pendanaan', w: 10, u: '%', t: '>= 5%' },
      { p: 'customer', o: 'C2. Meningkatkan Jumlah Nasabah Baru dan Mempertahankan Nasabah Existing Secara Berkelanjutan', k: 'C2.2 # NOA Akuisisi Dana Pihak Ketiga', w: 10, u: 'Angka', t: '100%' },
      { p: 'customer', o: 'C3. Meningkatkan Proporsi Dana Murah (CASA) Dalam Struktur Dana Pihak Ketiga', k: 'C3.1 % Rasio Dana Murah (CASA Ratio)', w: 10, u: '%', t: '>= 60%' },
      { p: 'internal_process', o: 'B4. Meningkatkan Implementasi Inisiatif Produk dan Layanan Sesuai Kebutuhan Pasar', k: 'B4.1 % Implementasi Strategi Inisiatif Terkait Produk Dana', w: 20, u: '%', t: '100%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi', k: 'L2.2 # Training Mandays', w: 10, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan', k: 'L3.1 # Culture Implementation Index', w: 10, u: 'Skor', t: '>= 80' },
    ]
  },
  {
    units: ['Divisi Digital Banking'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan', k: 'F3.1. % Rasio Biaya Terhadap Pendapatan (Cost to Income Ratio / CIR)', w: 10, u: '%', t: '<= 75%' },
      { p: 'customer', o: 'C5. Meningkatkan Penggunaan Layanan Digital Oleh Nasabah Secara Aktif', k: 'C5.1 % Pertumbuhan Pengguna Layanan Digital', w: 15, u: '%', t: '>= 25%' },
      { p: 'customer', o: 'C5. Meningkatkan Penggunaan Layanan Digital Oleh Nasabah Secara Aktif', k: 'C5.2 Rp Fee Income Digital', w: 15, u: 'Rp', t: '100%' },
      { p: 'internal_process', o: 'B4. Meningkatkan Implementasi Inisiatif Produk dan Layanan Sesuai Kebutuhan Pasar', k: 'B4.1 % Implementasi Strategi Inisiatif Produk Digital', w: 20, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B6. Meningkatkan Implementasi Digitalisasi Proses Operasional Secara end-to-end', k: 'B6.1 # Implementasi Peningkatan Digital Channel', w: 20, u: 'Angka', t: '100%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi', k: 'L2.1 # Digital Skill Index', w: 10, u: 'Skor', t: '>= 75' },
      { p: 'learning_growth', o: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan', k: 'L3.1 # Culture Implementation Index', w: 10, u: 'Skor', t: '>= 80' },
    ]
  },
  {
    units: ['Divisi Audit Internal', 'Unit Audit Internal Syariah', 'Unit Anti Fraud', 'UKK Internal Control over Financial Report', 'Unit Pengendalian Gratifikasi'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan', k: 'F3.1. % Rasio Biaya Terhadap Pendapatan (Cost to Income Ratio / CIR)', w: 15, u: '%', t: '<= 75%' },
      { p: 'customer', o: 'C6. Meningkatkan Tingkat Kepuasan dan Loyalitas Pelanggan Berbasis Kualitas Layanan', k: 'C6.1 # Indeks Kepuasan Stakeholder / Auditee', w: 15, u: 'Skor', t: '>= 80' },
      { p: 'internal_process', o: 'B7. Meningkatkan Penyelesaian Tindak Lanjut Atas Temuan Audit Secara Tepat Waktu', k: 'B7.1 % Penyelesaian Tindak Lanjut Temuan', w: 25, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B8. Memastikan Tingkat Kesehatan Bank Melalui Penguatan Manajemen Risiko dan Kepatuhan', k: 'B8.2 Zero Major Fraud / Pelanggaran Signifikan', w: 25, u: 'Angka', t: '0' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi', k: 'L2.2 # Training Mandays', w: 10, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan', k: 'L3.1 # Culture Implementation Index', w: 10, u: 'Skor', t: '>= 80' },
    ]
  },
  {
    units: ['Divisi Kepatuhan', 'Unit Kepatuhan Syariah'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan', k: 'F3.1. % Rasio Biaya Terhadap Pendapatan (Cost to Income Ratio / CIR)', w: 15, u: '%', t: '<= 75%' },
      { p: 'financial', o: 'F6. Meminimalkan Potensi Kerugian Finansial Akibat Pelanggaran Kepatuhan', k: 'F6.1 Rp Nilai Kerugian Aktual Akibat Pelanggaran Kepatuhan', w: 15, u: 'Rp', t: '0' },
      { p: 'customer', o: 'C6. Meningkatkan Tingkat Kepuasan dan Loyalitas Pelanggan Berbasis Kualitas Layanan', k: 'C6.1 # Indeks Kepuasan Stakeholder / Regulator', w: 15, u: 'Skor', t: '>= 80' },
      { p: 'internal_process', o: 'B8. Memastikan Tingkat Kesehatan Bank Melalui Penguatan Manajemen Risiko dan Kepatuhan', k: 'B8.1 # Compliance Maturity Level / TKB', w: 35, u: 'Skor', t: '>= 4 / PK-2' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi', k: 'L2.2 # Training Mandays', w: 10, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan', k: 'L3.1 # Culture Implementation Index', w: 10, u: 'Skor', t: '>= 80' },
    ]
  },
  {
    units: ['Divisi Manajemen Risiko', 'Divisi Credit Risk', 'Unit Manajemen Risiko Syariah'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan', k: 'F3.1. % Rasio Biaya Terhadap Pendapatan (Cost to Income Ratio / CIR)', w: 15, u: '%', t: '<= 75%' },
      { p: 'financial', o: 'F6. Meminimalkan Potensi Kerugian Finansial Akibat Pelanggaran Kepatuhan', k: 'F6.2 Minimalisasi Kerugian Operasional (Operational Risk Loss)', w: 15, u: 'Rp', t: '0' },
      { p: 'customer', o: 'C6. Meningkatkan Tingkat Kepuasan dan Loyalitas Pelanggan Berbasis Kualitas Layanan', k: 'C6.1 # Indeks Kepuasan Stakeholder (Internal NPS)', w: 10, u: 'Skor', t: '>= 80' },
      { p: 'internal_process', o: 'B8. Memastikan Tingkat Kesehatan Bank Melalui Penguatan Manajemen Risiko dan Kepatuhan', k: 'B8.1 # Profil Risiko Bank', w: 40, u: 'Skor', t: 'Low/Moderate' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi', k: 'L2.2 # Training Mandays', w: 10, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan', k: 'L3.1 # Culture Implementation Index', w: 10, u: 'Skor', t: '>= 80' },
    ]
  },
  {
    units: ['Divisi Teknologi Informasi', 'Unit Keamanan dan Ketahan Siber'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan', k: 'F3.1. % Rasio Biaya Terhadap Pendapatan (Cost to Income Ratio / CIR)', w: 15, u: '%', t: '<= 75%' },
      { p: 'customer', o: 'C6. Meningkatkan Tingkat Kepuasan dan Loyalitas Pelanggan Berbasis Kualitas Layanan', k: 'C6.1 # IT Service Satisfaction Index', w: 15, u: 'Skor', t: '>= 85' },
      { p: 'internal_process', o: 'B6. Meningkatkan Implementasi Digitalisasi Proses Operasional Secara end-to-end', k: 'B6.1 # System Uptime (SLA) & Keamanan Siber', w: 50, u: '%', t: '99.9%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi', k: 'L2.1 # Digital Skill Index', w: 10, u: 'Skor', t: '>= 80' },
      { p: 'learning_growth', o: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan', k: 'L3.1 # Culture Implementation Index', w: 10, u: 'Skor', t: '>= 80' },
    ]
  },
  {
    units: ['Divisi Operasional', 'Divisi Umum'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan', k: 'F3.1. % Rasio Biaya Terhadap Pendapatan (Cost to Income Ratio / CIR)', w: 20, u: '%', t: '<= 75%' },
      { p: 'customer', o: 'C6. Meningkatkan Tingkat Kepuasan dan Loyalitas Pelanggan Berbasis Kualitas Layanan', k: 'C6.1 # SLA Layanan Operasional & Umum', w: 20, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B6. Meningkatkan Implementasi Digitalisasi Proses Operasional Secara end-to-end', k: 'B6.1 % Efisiensi & Digitalisasi Proses Operasional', w: 40, u: '%', t: '100%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi', k: 'L2.2 # Training Mandays', w: 10, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan', k: 'L3.1 # Culture Implementation Index', w: 10, u: 'Skor', t: '>= 80' },
    ]
  },
  {
    units: ['Divisi Penyelamatan Kredit'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan', k: 'F3.1. % Rasio Biaya Terhadap Pendapatan (Cost to Income Ratio / CIR)', w: 10, u: '%', t: '<= 75%' },
      { p: 'customer', o: 'C6. Meningkatkan Tingkat Kepuasan dan Loyalitas Pelanggan Berbasis Kualitas Layanan', k: 'C6.1 # Internal NPS', w: 10, u: 'Skor', t: '>= 80' },
      { p: 'internal_process', o: 'B2. Meningkatkan Efektivitas Recovery Kredit Bermasalah', k: 'B2.1 % Recovery Rate Kredit Macet', w: 40, u: '%', t: '>= 80%' },
      { p: 'internal_process', o: 'B3. Menurunkan Rasio Kredit Bermasalah Dan Meningkatkan Penyelesaian Kredit Bermasalah', k: 'B3.1 % Penurunan NPL Gross', w: 20, u: '%', t: '<= 2.5%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi', k: 'L2.2 # Training Mandays', w: 10, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan', k: 'L3.1 # Culture Implementation Index', w: 10, u: 'Skor', t: '>= 80' },
    ]
  },
  {
    units: ['Divisi Perencanaan Strategis'],
    kpis: [
      { p: 'financial', o: 'F1. Mengoptimalkan Laba Bersih dan Tingkat Pengembalian Aset Secara Konsisten', k: 'F1.1 Pencapaian Laba Bersih Bank (RBB)', w: 10, u: '%', t: '100%' },
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan', k: 'F3.1. % Rasio Biaya Terhadap Pendapatan (Cost to Income Ratio / CIR)', w: 10, u: '%', t: '<= 75%' },
      { p: 'customer', o: 'C6. Meningkatkan Tingkat Kepuasan dan Loyalitas Pelanggan Berbasis Kualitas Layanan', k: 'C6.1 # Stakeholder Satisfaction Index', w: 20, u: 'Skor', t: '>= 85' },
      { p: 'internal_process', o: 'B5. Mengoptimalkan Kualitas Perencanaan Strategis Perusahaan', k: 'B5.1 Realisasi Program Kerja Strategic Sesuai Timeline', w: 40, u: '%', t: '100%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi', k: 'L2.2 # Training Mandays', w: 10, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan', k: 'L3.1 # Culture Implementation Index', w: 10, u: 'Skor', t: '>= 80' },
    ]
  },
  {
    units: ['Divisi Human Capital'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan', k: 'F3.1. % Rasio Biaya Terhadap Pendapatan (Cost to Income Ratio / CIR)', w: 20, u: '%', t: '<= 75%' },
      { p: 'customer', o: 'C6. Meningkatkan Tingkat Kepuasan dan Loyalitas Pelanggan Berbasis Kualitas Layanan', k: 'C6.1 # Internal NPS (Employee Services)', w: 20, u: 'Skor', t: '>= 80' },
      { p: 'internal_process', o: 'B5. Mengoptimalkan Kualitas Perencanaan Strategis Perusahaan', k: 'B5.1 Produktivitas Karyawan (EBITDA per Karyawan)', w: 40, u: 'Rp', t: '100%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi', k: 'L2.2 # Training Mandays', w: 10, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan', k: 'L3.1 # Culture Implementation Index', w: 10, u: 'Skor', t: '>= 80' },
    ]
  },
  {
    units: ['Divisi Corporate Secretary', 'Departemen Marketing Communication', 'Departemen Perlindungan Konsumen', 'Departemen Hukum'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional Melalui Pengendalian Rasio Biaya Terhadap Pendapatan', k: 'F3.1. % Rasio Biaya Terhadap Pendapatan (Cost to Income Ratio / CIR)', w: 20, u: '%', t: '<= 75%' },
      { p: 'customer', o: 'C7. Meningkatkan Tingkat Pengenalan dan Persepsi Positif Masyarakat Terhadap Bank', k: 'C7.1 # Indeks Brand Awareness / Corporate Image / Kepuasan', w: 20, u: 'Skor', t: '>= 80' },
      { p: 'internal_process', o: 'B7. Meningkatkan Penyelesaian Tindak Lanjut Atas Temuan Audit Secara Tepat Waktu', k: 'B7.2 Tingkat Penyelesaian Keluhan Nasabah / Kasus Hukum', w: 40, u: '%', t: '100%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan Melalui Pengembangan Skill, Pelatihan, dan Sertifikasi', k: 'L2.2 # Training Mandays', w: 10, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Meningkatkan Penerapan Budaya Perusahaan Dalam Perilaku Kerja Karyawan', k: 'L3.1 # Culture Implementation Index', w: 10, u: 'Skor', t: '>= 80' },
    ]
  }
];

async function seed() {
  try {
    // Hapus KPI Unit divisi sebelumnya agar bersih dan bobot tepat 100%
    await pool.query("DELETE FROM kpis WHERE unit_type = 'divisi'");
    console.log('🧹 Membersihkan KPI Divisi lama...');

    for (const group of groups) {
      for (const unit of group.units) {
        let totalWeight = 0;
        for (const kpi of group.kpis) {
          const kpiId = crypto.randomUUID();
          await pool.query(
            `INSERT INTO kpis 
            (id, name, perspective, unit, target, actual, weight, unit_name, jabatan, unit_type, status, description, formula, objective) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              kpiId, 
              kpi.k, 
              kpi.p, 
              kpi.u, 
              kpi.t, 
              0, 
              kpi.w, 
              unit, 
              '', 
              'divisi', 
              'Draft', 
              '', 
              '', 
              kpi.o
            ]
          );
          totalWeight += kpi.w;
        }
        console.log(`[+] Disisipkan KPI untuk ${unit} (Total Bobot: ${totalWeight}%)`);
      }
    }
    console.log('\n✅ Proses Update KPI Unit 100% Balanced Scorecard berhasil diselesaikan!');
  } catch (error) {
    console.error('Error saat menyisipkan data:', error);
  } finally {
    pool.end();
  }
}

seed();