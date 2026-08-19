const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'kpi_corporate',
});

// 17 Divisi
const divisiData = [
  {
    units: ['Divisi Keuangan'],
    kpis: [
      { p: 'financial', o: 'F1. Mengoptimalkan Laba Bersih', k: 'F1.1. Pencapaian Laba Bersih Bank', w: 10, u: '%', t: '100%' },
      { p: 'financial', o: 'F1. Mengoptimalkan Laba Bersih', k: 'F1.2. % Return on Equity (ROE)', w: 10, u: '%', t: '>= 15%' },
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional', k: 'F3.1. % Cost to Income Ratio (CIR) Bank', w: 10, u: '%', t: '<= 75%' },
      { p: 'customer', o: 'C6. Tingkat Kepuasan Internal', k: 'C6.1. SLA Proses Pembayaran Tagihan/Vendor', w: 10, u: '%', t: '100%' },
      { p: 'customer', o: 'C6. Tingkat Kepuasan Internal', k: 'C6.2. Indeks Kepuasan Layanan Keuangan Internal', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'internal_process', o: 'B8. Memastikan Tingkat Kesehatan Bank', k: 'B8.1. Opini Wajar Tanpa Pengecualian (WTP) KAP', w: 10, u: 'Index', t: 'WTP' },
      { p: 'internal_process', o: 'B8. Memastikan Tingkat Kesehatan Bank', k: 'B8.2. Akurasi Laporan Keuangan Bank', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B7. Penyelesaian Temuan', k: 'B7.1. Zero Keterlambatan Laporan BI/OJK/Pajak', w: 10, u: 'Angka', t: '0' },
      { p: 'internal_process', o: 'B7. Penyelesaian Temuan', k: 'B7.2. % Penyelesaian Temuan Audit Terkait Keuangan', w: 10, u: '%', t: '100%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi Treasury'],
    kpis: [
      { p: 'financial', o: 'F2. Mengoptimalkan Pertumbuhan Pendapatan', k: 'F2.1. Pendapatan Bunga Treasury (NIM)', w: 10, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F2. Mengoptimalkan Pertumbuhan Pendapatan', k: 'F2.2. Fee Based Income (FBI) Transaksi Valas', w: 10, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'customer', o: 'C6. Tingkat Kepuasan Internal', k: 'C6.1. SLA Transaksi Valas & Dealing Room', w: 10, u: '%', t: '100%' },
      { p: 'customer', o: 'C6. Tingkat Kepuasan Internal', k: 'C6.2. Indeks Kepuasan Cabang terhadap Pricing/Rate', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'internal_process', o: 'B1. Likuiditas Bank', k: 'B1.1. Pemenuhan Rasio LCR & NSFR Sesuai Ketentuan', w: 10, u: '%', t: '>= 100%' },
      { p: 'internal_process', o: 'B8. Manajemen Risiko', k: 'B8.1. Zero Limit Breach (Pelanggaran Limit Transaksi)', w: 10, u: 'Angka', t: '0' },
      { p: 'internal_process', o: 'B1. Likuiditas Bank', k: 'B1.2. Pemenuhan Ketentuan GWM BI', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B1. Likuiditas Bank', k: 'B1.3. Return on Investment (ROI) Portofolio Surat Berharga', w: 10, u: '%', t: '>= Target' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi SME & Commercial'],
    kpis: [
      { p: 'financial', o: 'F2. Mengoptimalkan Pertumbuhan Pendapatan', k: 'F2.1. Pencapaian Pendapatan Bunga Kredit SME', w: 10, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F2. Mengoptimalkan Pertumbuhan Pendapatan', k: 'F2.2. Pencapaian Fee Based Income (FBI) SME', w: 10, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'customer', o: 'C1. Meningkatkan Pangsa Pasar', k: 'C1.1. Market Share Kredit SME', w: 10, u: '%', t: '>= 5%' },
      { p: 'customer', o: 'C2. Nasabah Baru', k: 'C2.1. Pertumbuhan NOA Debitur Baru SME', w: 10, u: 'Angka', t: '100%' },
      { p: 'customer', o: 'C6. Kepuasan Pelanggan', k: 'C6.1. Indeks Kepuasan Debitur SME', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'internal_process', o: 'B1. Pertumbuhan Kredit', k: 'B1.1. Pertumbuhan O/S Kredit SME', w: 10, u: '%', t: '>= 15%' },
      { p: 'internal_process', o: 'B3. Menurunkan Rasio Kredit Bermasalah', k: 'B3.1. Rasio NPL Gross SME', w: 10, u: '%', t: '<= 3%' },
      { p: 'internal_process', o: 'B1. Pertumbuhan Kredit', k: 'B1.2. SLA Proses Putusan Kredit SME', w: 10, u: 'Hari', t: '<= SLA' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi Kredit Konsumer'],
    kpis: [
      { p: 'financial', o: 'F2. Mengoptimalkan Pertumbuhan Pendapatan', k: 'F2.1. Pencapaian Pendapatan Bunga Kredit Konsumer', w: 10, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F2. Mengoptimalkan Pertumbuhan Pendapatan', k: 'F2.2. Pencapaian Fee Based Income (FBI) Konsumer', w: 10, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'customer', o: 'C1. Meningkatkan Pangsa Pasar', k: 'C1.1. Market Share Kredit Konsumer', w: 10, u: '%', t: '>= 10%' },
      { p: 'customer', o: 'C2. Nasabah Baru', k: 'C2.1. Pertumbuhan NOA Debitur Baru Konsumer', w: 10, u: 'Angka', t: '100%' },
      { p: 'customer', o: 'C6. Kepuasan Pelanggan', k: 'C6.1. Indeks Kepuasan Debitur Konsumer', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'internal_process', o: 'B1. Pertumbuhan Kredit', k: 'B1.1. Pertumbuhan O/S Kredit Konsumer', w: 10, u: '%', t: '>= 15%' },
      { p: 'internal_process', o: 'B3. Menurunkan Rasio Kredit Bermasalah', k: 'B3.1. Rasio NPL Gross Konsumer', w: 10, u: '%', t: '<= 2%' },
      { p: 'internal_process', o: 'B1. Pertumbuhan Kredit', k: 'B1.2. SLA Proses Putusan Kredit Konsumer', w: 10, u: 'Hari', t: '<= SLA' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi Funding & Wealth Management'],
    kpis: [
      { p: 'financial', o: 'F5. Pertumbuhan Dana Pihak Ketiga', k: 'F5.1. Pertumbuhan O/S DPK Bank', w: 10, u: '%', t: '>= 15%' },
      { p: 'financial', o: 'F2. Pertumbuhan Pendapatan', k: 'F2.1. Fee Based Income (Bancassurance & Reksadana)', w: 10, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'customer', o: 'C2. Nasabah Baru', k: 'C2.1. Pertumbuhan NOA Tabungan & Giro', w: 10, u: 'Angka', t: '100%' },
      { p: 'customer', o: 'C3. Proporsi Dana Murah', k: 'C3.1. Pertumbuhan CASA Bank', w: 10, u: '%', t: '>= 20%' },
      { p: 'customer', o: 'C6. Kepuasan Pelanggan', k: 'C6.1. Indeks Kepuasan Nasabah Funding/Prioritas', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'internal_process', o: 'B4. Implementasi Inisiatif Produk', k: 'B4.1. Efisiensi Cost of Fund (CoF) DPK', w: 10, u: '%', t: '<= Target' },
      { p: 'internal_process', o: 'B4. Implementasi Inisiatif Produk', k: 'B4.2. Realisasi Program Akuisisi Nasabah', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B4. Implementasi Inisiatif Produk', k: 'B4.3. Cross-selling Ratio Produk Wealth Management', w: 10, u: 'Ratio', t: '>= 2.0' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi Digital Banking'],
    kpis: [
      { p: 'financial', o: 'F2. Pertumbuhan Pendapatan', k: 'F2.1. Fee Income Channel Digital & Merchant', w: 10, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F2. Pertumbuhan Pendapatan', k: 'F2.2. Volume Transaksi Finansial Digital (Rp)', w: 10, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'customer', o: 'C5. Penggunaan Layanan Digital', k: 'C5.1. Pertumbuhan User Aktif Aplikasi Mobile', w: 10, u: 'Angka', t: '>= 25%' },
      { p: 'customer', o: 'C5. Penggunaan Layanan Digital', k: 'C5.2. Rating Aplikasi di Play Store / App Store', w: 10, u: 'Skor', t: '>= 4.2' },
      { p: 'customer', o: 'C6. Kepuasan Pelanggan', k: 'C6.1. SLA Penyelesaian Keluhan Nasabah Digital', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B6. Implementasi Digitalisasi', k: 'B6.1. System Availability & Reliability Digital Channel', w: 10, u: '%', t: '>= 99.9%' },
      { p: 'internal_process', o: 'B6. Implementasi Digitalisasi', k: 'B6.2. % Fitur Baru yang Dirilis Tepat Waktu (On Time to Market)', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B6. Implementasi Digitalisasi', k: 'B6.3. Zero Major Bug pada Rilis Aplikasi Baru', w: 10, u: 'Angka', t: '0' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi Audit Internal'],
    kpis: [
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Audit (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F6. Meminimalkan Kerugian', k: 'F6.1. Recovery Finansial dari Temuan Audit/Fraud', w: 10, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.2. Efisiensi Biaya Perjalanan Dinas Audit', w: 10, u: '%', t: '<= 100%' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.1. Indeks Kepuasan Auditee (Value Added Audit)', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.2. SLA Penerbitan LHA sejak Closing Meeting', w: 10, u: 'Hari', t: '<= 14' },
      { p: 'internal_process', o: 'B7. Tindak Lanjut Audit', k: 'B7.1. % Realisasi Program Kerja Audit Tahunan (PKAT)', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B7. Tindak Lanjut Audit', k: 'B7.2. % Tindak Lanjut Temuan Audit oleh Manajemen', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B7. Tindak Lanjut Audit', k: 'B7.3. Skor Kualitas Kertas Kerja Audit (Peer Review)', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'internal_process', o: 'B8. Manajemen Risiko', k: 'B8.1. Zero Temuan Berulang (Repeat Finding) Signifikan', w: 10, u: 'Angka', t: '0' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi Corporate Secretary'],
    kpis: [
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Divisi (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.2. Efisiensi Penggunaan Anggaran CSR/TJSL', w: 10, u: '%', t: '100%' },
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.3. Efisiensi Biaya Pelaksanaan RUPS', w: 10, u: '%', t: '<= 100%' },
      { p: 'customer', o: 'C7. Persepsi Masyarakat', k: 'C7.1. Indeks Brand Awareness & Reputasi Perusahaan', w: 10, u: 'Skor', t: '>= 80' },
      { p: 'customer', o: 'C6. Kepuasan Stakeholder', k: 'C6.1. Indeks Kepuasan Stakeholder & Pemegang Saham', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'internal_process', o: 'B8. Kepatuhan', k: 'B8.1. Pelaksanaan RUPS Tahunan Sesuai Jadwal Ketentuan', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B7. Kepatuhan', k: 'B7.1. Zero Keterlambatan Keterbukaan Informasi ke OJK/BEI', w: 10, u: 'Angka', t: '0' },
      { p: 'internal_process', o: 'B7. Kepatuhan', k: 'B7.2. SLA Respon & Klasifikasi Krisis Komunikasi Media', w: 10, u: 'Jam', t: '<= 24' },
      { p: 'internal_process', o: 'B5. Perencanaan Strategis', k: 'B5.1. % Realisasi & Eksekusi Program CSR Tepat Sasaran', w: 10, u: '%', t: '100%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi Human Capital'],
    kpis: [
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Divisi (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.2. EBITDA per Karyawan', w: 10, u: 'Rp', t: '>= Target' },
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.3. Efisiensi Biaya Pegawai (Cost per Hire/Training)', w: 10, u: '%', t: '<= 100%' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.1. Employee Engagement Index (EEI)', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.2. SLA Rekrutmen Pegawai (Time to Fill)', w: 10, u: 'Hari', t: '<= 45' },
      { p: 'internal_process', o: 'B5. Perencanaan Strategis', k: 'B5.1. % Pemenuhan Formasi Karyawan (Manpower Planning)', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B5. Perencanaan Strategis', k: 'B5.2. % Karyawan Kategori Talent (Succession Plan)', w: 10, u: '%', t: '>= 15%' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses', k: 'B6.1. Zero Kesalahan (Akurasi) Perhitungan Payroll', w: 10, u: 'Angka', t: '0' },
      { p: 'internal_process', o: 'B5. Perencanaan Strategis', k: 'B5.3. % Eksekusi Program Pelatihan Sesuai TNA', w: 10, u: '%', t: '100%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi Kepatuhan'],
    kpis: [
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Divisi (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F6. Meminimalkan Kerugian', k: 'F6.1. Zero Denda Finansial dari OJK/BI', w: 10, u: 'Rp', t: '0' },
      { p: 'financial', o: 'F6. Meminimalkan Kerugian', k: 'F6.2. Zero Penalti Hukum/Pajak akibat Non-Compliance', w: 10, u: 'Rp', t: '0' },
      { p: 'customer', o: 'C6. Kepuasan Eksternal', k: 'C6.1. Indeks Kepuasan Regulator (OJK/BI)', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.2. SLA Review Kepatuhan Produk Baru', w: 10, u: 'Hari', t: '<= 7' },
      { p: 'internal_process', o: 'B8. Manajemen Risiko', k: 'B8.1. Skor Compliance Maturity Level', w: 10, u: 'Skor', t: '>= 4' },
      { p: 'internal_process', o: 'B8. Manajemen Risiko', k: 'B8.2. Zero Keterlambatan Pelaporan Rutin Regulator', w: 10, u: 'Angka', t: '0' },
      { p: 'internal_process', o: 'B8. Manajemen Risiko', k: 'B8.3. % Pelaksanaan Program APU PPT Sesuai Rencana', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B7. Tindak Lanjut', k: 'B7.1. % Penyelesaian Komitmen Tindak Lanjut Temuan OJK', w: 10, u: '%', t: '100%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi Manajemen Risiko'],
    kpis: [
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Divisi (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F6. Meminimalkan Kerugian', k: 'F6.1. Minimalisasi Kerugian Operasional (Operational Loss)', w: 10, u: 'Rp', t: '<= Toleransi' },
      { p: 'financial', o: 'F6. Meminimalkan Kerugian', k: 'F6.2. Akurasi Perhitungan Pencadangan (CKPN)', w: 10, u: '%', t: '100%' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.1. Indeks Kepuasan Unit Bisnis (Advisory Risiko)', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.2. SLA Penerbitan Risk Assessment (Produk/Inisiatif Baru)', w: 10, u: 'Hari', t: '<= 10' },
      { p: 'internal_process', o: 'B8. Manajemen Risiko', k: 'B8.1. Pemeliharaan Tingkat Kesehatan Bank (TKB)', w: 10, u: 'Skor', t: 'PK-2' },
      { p: 'internal_process', o: 'B8. Manajemen Risiko', k: 'B8.2. Mempertahankan Profil Risiko Bank (Low/Moderate)', w: 10, u: 'Skor', t: 'Low/Moderate' },
      { p: 'internal_process', o: 'B8. Manajemen Risiko', k: 'B8.3. % Kepatuhan Terhadap Limit Risiko (Zero Limit Breach)', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B8. Manajemen Risiko', k: 'B8.4. Pelaksanaan Stress Testing Tepat Waktu', w: 10, u: '%', t: '100%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi Credit Risk'],
    kpis: [
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Divisi (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F6. Meminimalkan Kerugian', k: 'F6.1. Cost of Credit (Biaya Pencadangan Kredit)', w: 10, u: '%', t: '<= Target' },
      { p: 'financial', o: 'F6. Meminimalkan Kerugian', k: 'F6.2. Akurasi Proyeksi NPL & Pencadangan', w: 10, u: '%', t: '>= 95%' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.1. SLA Persetujuan Kredit (Four Eyes Principle)', w: 10, u: 'Hari', t: '<= SLA' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.2. Indeks Kepuasan Unit Bisnis Terhadap Proses Review', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'internal_process', o: 'B3. Kualitas Kredit', k: 'B3.1. Pengendalian NPL Gross Bank', w: 10, u: '%', t: '<= 2.5%' },
      { p: 'internal_process', o: 'B3. Kualitas Kredit', k: 'B3.2. Pengendalian Loan at Risk (LAR)', w: 10, u: '%', t: '<= Target' },
      { p: 'internal_process', o: 'B8. Manajemen Risiko', k: 'B8.1. Akurasi Model Rating/Scoring Kredit', w: 10, u: '%', t: '>= 85%' },
      { p: 'internal_process', o: 'B8. Manajemen Risiko', k: 'B8.2. % Penyelesaian Review Portofolio Kredit Tepat Waktu', w: 10, u: '%', t: '100%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi Operasional'],
    kpis: [
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Divisi (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.2. Efisiensi Biaya Operasional Cabang (Monitoring)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F6. Meminimalkan Kerugian', k: 'F6.1. Zero Selisih Kas Fisik & Saldo Giro BI', w: 10, u: 'Rp', t: '0' },
      { p: 'customer', o: 'C6. Kepuasan Eksternal', k: 'C6.1. SLA Layanan Transaksi Cabang (Waktu Antri/Layan)', w: 10, u: 'Menit', t: '<= SLA' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.2. Indeks Kepuasan Cabang thd Dukungan Operasional', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses', k: 'B6.1. Akurasi Transaksi Kliring/RTGS/BI-FAST', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses', k: 'B6.2. Tingkat Sentralisasi Proses Back Office Cabang', w: 10, u: '%', t: '>= Target' },
      { p: 'internal_process', o: 'B8. Manajemen Risiko', k: 'B8.1. Zero Keterlambatan Laporan Operasional/BI', w: 10, u: 'Angka', t: '0' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses', k: 'B6.3. SLA Rekonsiliasi Transaksi Harian', w: 10, u: '%', t: '100%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi Teknologi Informasi'],
    kpis: [
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran OPEX IT (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.2. Efisiensi Penggunaan CAPEX IT', w: 10, u: '%', t: '100%' },
      { p: 'financial', o: 'F6. Meminimalkan Kerugian', k: 'F6.1. Zero Kerugian Finansial Akibat Gangguan IT Major', w: 10, u: 'Rp', t: '0' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.1. IT Service Satisfaction Index (Karyawan)', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.2. SLA Penyelesaian Tiket Helpdesk IT', w: 10, u: '%', t: '>= 95%' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses', k: 'B6.1. Core Banking System Uptime (SLA)', w: 10, u: '%', t: '>= 99.9%' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses', k: 'B6.2. Zero Priority 1 (Kritis) System Incident', w: 10, u: 'Angka', t: '0' },
      { p: 'internal_process', o: 'B4. Implementasi Inisiatif', k: 'B4.1. % Proyek Pengembangan IT Selesai Tepat Waktu', w: 10, u: '%', t: '>= 90%' },
      { p: 'internal_process', o: 'B8. Manajemen Risiko', k: 'B8.1. Tingkat Keberhasilan Uji Coba DRP/BCP', w: 10, u: '%', t: '100%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi Penyelamatan Kredit'],
    kpis: [
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Divisi (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F2. Pertumbuhan Pendapatan', k: 'F2.1. Pendapatan Recovery (Penerimaan Tagihan Hapus Buku)', w: 10, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.2. Minimalisasi Biaya Eksekusi Lelang/Hukum', w: 10, u: '%', t: '<= 100%' },
      { p: 'customer', o: 'C6. Kepuasan Eksternal', k: 'C6.1. SLA Proses Persetujuan Restrukturisasi Kredit', w: 10, u: 'Hari', t: '<= SLA' },
      { p: 'customer', o: 'C6. Kepuasan Eksternal', k: 'C6.2. Penurunan Jumlah Keluhan Debitur Macet (Eskalasi OJK)', w: 10, u: 'Angka', t: '<= Toleransi' },
      { p: 'internal_process', o: 'B2. Efektivitas Recovery', k: 'B2.1. Recovery Rate Kredit Hapus Buku', w: 10, u: '%', t: '>= Target' },
      { p: 'internal_process', o: 'B3. Menurunkan Rasio Kredit Bermasalah', k: 'B3.1. Penurunan Nominal NPL Gross Secara Konsolidasi', w: 10, u: 'Rp', t: '>= Target' },
      { p: 'internal_process', o: 'B2. Efektivitas Recovery', k: 'B2.2. Tingkat Keberhasilan Restrukturisasi (Tidak Macet Lagi)', w: 10, u: '%', t: '>= 80%' },
      { p: 'internal_process', o: 'B2. Efektivitas Recovery', k: 'B2.3. % Eksekusi Lelang Agunan Berhasil', w: 10, u: '%', t: '>= Target' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi Perencanaan Strategis'],
    kpis: [
      { p: 'financial', o: 'F1. Mengoptimalkan Laba Bersih', k: 'F1.1. Akurasi Pencapaian Laba Bersih vs RBB', w: 10, u: '%', t: '100%' },
      { p: 'financial', o: 'F2. Pertumbuhan Pendapatan', k: 'F2.1. Akurasi Pencapaian Total Aset vs RBB', w: 10, u: '%', t: '100%' },
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Divisi (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.1. Indeks Kepuasan Direksi/Stakeholder terhadap Corplan', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.2. SLA Penyusunan RBB & Corporate Plan Tahunan', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B5. Kualitas Perencanaan', k: 'B5.1. % Realisasi Program Kerja Strategis Bank', w: 10, u: '%', t: '>= 90%' },
      { p: 'internal_process', o: 'B5. Kualitas Perencanaan', k: 'B5.2. Tingkat Deviasi Realisasi RBB (Maksimal)', w: 10, u: '%', t: '<= 10%' },
      { p: 'internal_process', o: 'B5. Kualitas Perencanaan', k: 'B5.3. Penyusunan Kajian Makro & Industri Tepat Waktu', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B5. Kualitas Perencanaan', k: 'B5.4. Indeks Keberhasilan Program Transformasi Bisnis', w: 10, u: 'Skor', t: '>= Target' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  },
  {
    units: ['Divisi Umum'],
    kpis: [
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Divisi (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.2. Efisiensi Biaya Pengadaan Barang & Jasa', w: 10, u: '%', t: '<= Target' },
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.3. Optimalisasi Aset Non-Produktif / Idle Asset', w: 10, u: 'Rp', t: '100%' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.1. Indeks Kepuasan Cabang thd Layanan Umum/Fasilitas', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'customer', o: 'C6. Kepuasan Internal', k: 'C6.2. SLA Proses Pengadaan Barang & Jasa', w: 10, u: 'Hari', t: '<= SLA' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses', k: 'B6.1. % Penyelesaian Proyek Fisik/Gedung Tepat Waktu', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B7. Penyelesaian Temuan', k: 'B7.1. Zero Temuan Audit Signifikan Terkait Pengadaan', w: 10, u: 'Angka', t: '0' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses', k: 'B6.2. SLA Perbaikan Fasilitas/Kerusakan Kantor', w: 10, u: 'Hari', t: '<= SLA' },
      { p: 'internal_process', o: 'B8. Manajemen Risiko', k: 'B8.1. % Kepatuhan Asuransi Aset Tetap Perusahaan', w: 10, u: '%', t: '100%' },
      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' }
    ]
  }
];

async function seed() {
  try {
    const unitNamesToUpdate = divisiData.flatMap(g => g.units);
    console.log('🧹 Membersihkan KPI Divisi lama...');
    for (const unit of unitNamesToUpdate) {
        await pool.query("DELETE FROM kpis WHERE unit_name = ?", [unit]);
    }

    for (const group of divisiData) {
      for (const unit of group.units) {
        let totalWeight = 0;
        let countLg = 0;
        for (const kpi of group.kpis) {
          if(kpi.p === 'learning_growth') countLg++;

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
        console.log(`[+] Disisipkan KPI Detail untuk ${unit} (Total Bobot: ${totalWeight}%, 4 Perspektif, Item Max 10%, L&G Items: ${countLg})`);
      }
    }
    console.log('\n✅ Proses Expand KPI Seluruh Divisi (17 Divisi) berhasil diselesaikan!');
  } catch (error) {
    console.error('Error saat menyisipkan data:', error);
  } finally {
    pool.end();
  }
}

seed();