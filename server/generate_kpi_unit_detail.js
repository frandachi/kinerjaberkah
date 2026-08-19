const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'kpi_corporate',
});

// Aturan Baru:
// 1. Bobot per item maksimal 10%
// 2. Learning & Growth item maksimal 5%
// 3. Lebih detail & dikembangkan di luar KPI Corporate Induk

const unitsData = [
  // ---------------------------------------------------------
  // 1. DEPARTEMEN HUKUM
  // ---------------------------------------------------------
  {
    units: ['Departemen Hukum'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Departemen Hukum (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F6. Meminimalkan Potensi Kerugian Finansial', k: 'F6.1. Rp Nilai Penyelamatan Aset/Kasus Hukum', w: 10, u: 'Rp', t: '100% Target' },
      
      { p: 'customer', o: 'C6. Meningkatkan Kepuasan Pelanggan Internal', k: 'C6.1. SLA Pemberian Opini Hukum (Legal Opinion)', w: 10, u: '%', t: '>= 95%' },
      { p: 'customer', o: 'C6. Meningkatkan Kepuasan Pelanggan Internal', k: 'C6.2. Indeks Kepuasan Layanan Bantuan Hukum Internal', w: 10, u: 'Skor', t: '>= 85' },
      
      { p: 'internal_process', o: 'B7. Memastikan Kepatuhan & Mitigasi Risiko', k: 'B7.1. % Kemenangan Penanganan Perkara Hukum (Litigasi)', w: 10, u: '%', t: '>= 80%' },
      { p: 'internal_process', o: 'B7. Memastikan Kepatuhan & Mitigasi Risiko', k: 'B7.2. % Penyelesaian Review Perjanjian Kerja Sama (PKS)', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B7. Memastikan Kepatuhan & Mitigasi Risiko', k: 'B7.3. Zero Temuan Signifikan Aspek Legal', w: 10, u: 'Angka', t: '0' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses Operasional', k: 'B6.1. Digitalisasi Arsip Dokumen Hukum & PKS', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B4. Inovasi Layanan Sesuai Pasar', k: 'B4.1. Sosialisasi & Edukasi Hukum ke Cabang/Divisi', w: 10, u: 'Kegiatan', t: '>= 4' },

      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan', k: 'L2.2. # Training Mandays Spesifik Hukum/Perbankan', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' },
    ]
  },
  // ---------------------------------------------------------
  // 2. DEPARTEMEN MARKETING COMMUNICATION
  // ---------------------------------------------------------
  {
    units: ['Departemen Marketing Communication'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Promosi & Iklan (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F2. Mengoptimalkan Pertumbuhan Pendapatan', k: 'F2.1. Rp ROI dari Kampanye Pemasaran Berbayar', w: 10, u: '%', t: '>= 15%' },

      { p: 'customer', o: 'C7. Pengenalan & Persepsi Positif Masyarakat', k: 'C7.1. Indeks Brand Awareness (Top of Mind)', w: 10, u: 'Skor', t: '>= 80' },
      { p: 'customer', o: 'C7. Pengenalan & Persepsi Positif Masyarakat', k: 'C7.2. % Pertumbuhan Followers & Engagement Media Sosial', w: 10, u: '%', t: '>= 25%' },
      { p: 'customer', o: 'C6. Tingkat Kepuasan Pelanggan', k: 'C6.1. SLA Respon Keluhan/Pertanyaan via Media Sosial', w: 10, u: 'Menit', t: '<= 30' },

      { p: 'internal_process', o: 'B4. Inovasi Produk & Layanan', k: 'B4.1. % Eksekusi Kalender Kampanye Marketing (On-Time)', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B4. Inovasi Produk & Layanan', k: 'B4.2. Jumlah Publikasi Press Release / Media Exposure', w: 10, u: 'Angka', t: '>= 24' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses Operasional', k: 'B6.1. Implementasi & Optimalisasi Digital Marketing Tools', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B7. Penguatan Kepatuhan', k: 'B7.1. Zero Pelanggaran Etika Pariwara/OJK dalam Iklan', w: 10, u: 'Angka', t: '0' },

      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan', k: 'L2.2. # Training Mandays (Digital Marketing/PR)', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' },
    ]
  },
  // ---------------------------------------------------------
  // 3. DEPARTEMEN PERLINDUNGAN KONSUMEN
  // ---------------------------------------------------------
  {
    units: ['Departemen Perlindungan Konsumen'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Departemen (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F6. Meminimalkan Potensi Kerugian Finansial', k: 'F6.1. Zero Denda Regulator Terkait Pelanggaran Konsumen', w: 10, u: 'Rp', t: '0' },

      { p: 'customer', o: 'C6. Meningkatkan Kepuasan & Loyalitas', k: 'C6.1. SLA Penyelesaian Pengaduan Nasabah (Tier 1 & 2)', w: 10, u: '%', t: '>= 95%' },
      { p: 'customer', o: 'C6. Meningkatkan Kepuasan & Loyalitas', k: 'C6.2. Indeks Kepuasan Penyelesaian Pengaduan (CSAT)', w: 10, u: 'Skor', t: '>= 80' },
      { p: 'customer', o: 'C7. Persepsi Positif Masyarakat', k: 'C7.1. Pelaksanaan Program Literasi & Edukasi Keuangan', w: 10, u: 'Kegiatan', t: '>= 12' },

      { p: 'internal_process', o: 'B8. Penguatan Kepatuhan & Manajemen Risiko', k: 'B8.1. % Kepatuhan Pelaporan SIPEDULI OJK Tepat Waktu', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B8. Penguatan Kepatuhan & Manajemen Risiko', k: 'B8.2. Zero Escalation Kasus Pengaduan ke LAPS/OJK', w: 10, u: 'Angka', t: '0' },
      { p: 'internal_process', o: 'B7. Penyelesaian Temuan', k: 'B7.1. % Penyelesaian Root Cause Analysis (RCA) Pengaduan', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses Operasional', k: 'B6.1. Pengembangan Sistem Manajemen Pengaduan (Ticketing)', w: 10, u: '%', t: '100%' },

      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan', k: 'L2.2. # Training Mandays (Service Excellence/Consumer Law)', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' },
    ]
  },
  // ---------------------------------------------------------
  // 4. UKK COMERCIAL BUSINESS CENTER
  // ---------------------------------------------------------
  {
    units: ['UKK Comercial Business Center'],
    kpis: [
      { p: 'financial', o: 'F2. Mengoptimalkan Pertumbuhan Pendapatan', k: 'F2.1. Pencapaian Target Pendapatan Bunga Kredit Komersial', w: 10, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F2. Mengoptimalkan Pertumbuhan Pendapatan', k: 'F2.2. Pencapaian Target Fee Based Income (Trade Finance, dll)', w: 10, u: 'Rp', t: '100%' },
      { p: 'financial', o: 'F3. Efisiensi Operasional', k: 'F3.1. % Cost of Fund (CoF) Dana Pihak Ketiga CBC', w: 10, u: '%', t: '<= Target RBB' },

      { p: 'customer', o: 'C1. Pangsa Pasar Kredit & DPK', k: 'C1.1. % Pertumbuhan O/S Kredit Komersial & Korporasi', w: 10, u: '%', t: '>= 15%' },
      { p: 'customer', o: 'C2. Akuisisi Nasabah Baru', k: 'C2.1. Akuisisi Nasabah Debitur Komersial Baru (NOA)', w: 10, u: 'Angka', t: '100% Target' },
      { p: 'customer', o: 'C3. Peningkatan CASA', k: 'C3.1. Pertumbuhan O/S Giro & Tabungan Bisnis (CASA CBC)', w: 10, u: '%', t: '>= 20%' },

      { p: 'internal_process', o: 'B1. Menjaga Kualitas Aset', k: 'B1.1. SLA Proses Persetujuan Kredit Komersial (End-to-End)', w: 10, u: 'Hari', t: '<= SLA' },
      { p: 'internal_process', o: 'B3. Menurunkan Rasio NPL', k: 'B3.1. Rasio NPL Gross Segmen Komersial', w: 10, u: '%', t: '<= 2.0%' },
      { p: 'internal_process', o: 'B4. Implementasi Produk', k: 'B4.1. Cross-Selling Ratio (Produk Funding/Treasury ke Debitur)', w: 10, u: 'Ratio', t: '>= 2.5' },

      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi Karyawan', k: 'L2.2. # Training Mandays (Credit Analysis/Corporate Finance)', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' },
    ]
  },
  // ---------------------------------------------------------
  // 5. UKK INTERNAL CONTROL OVER FINANCIAL REPORT
  // ---------------------------------------------------------
  {
    units: ['UKK Internal Control over Financial Report'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran UKK (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F6. Meminimalkan Potensi Kerugian Finansial', k: 'F6.1. Zero Denda akibat Kesalahan Laporan Keuangan (OJK/BI)', w: 10, u: 'Rp', t: '0' },

      { p: 'customer', o: 'C6. Tingkat Kepuasan Pelanggan Internal', k: 'C6.1. SLA Respon Konsultasi Kebijakan Akuntansi/Keuangan', w: 10, u: '%', t: '>= 95%' },
      { p: 'customer', o: 'C6. Tingkat Kepuasan Pelanggan Internal', k: 'C6.2. Indeks Kepuasan Auditee/Divisi Terkait', w: 10, u: 'Skor', t: '>= 85' },

      { p: 'internal_process', o: 'B7. Penyelesaian Temuan & Pengawasan', k: 'B7.1. % Penyelesaian Review ICFR Sesuai Rencana Tahunan', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B7. Penyelesaian Temuan & Pengawasan', k: 'B7.2. Zero Material Weakness dari Auditor Eksternal (KAP)', w: 10, u: 'Angka', t: '0' },
      { p: 'internal_process', o: 'B7. Penyelesaian Temuan & Pengawasan', k: 'B7.3. % Tindak Lanjut Perbaikan Sistem Akuntansi (Remediation)', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B8. Penguatan Manajemen Risiko', k: 'B8.1. Pemutakhiran Risk Control Matrix (RCM) Tahunan', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses', k: 'B6.1. Pemanfaatan Tools Audit/Monitoring Berbasis Data', w: 10, u: '%', t: '>= 80%' },

      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays (PSAK/IFRS/Audit)', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' },
    ]
  },
  // ---------------------------------------------------------
  // 6. UNIT ANTI FRAUD
  // ---------------------------------------------------------
  {
    units: ['Unit Anti Fraud'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Unit (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F6. Meminimalkan Potensi Kerugian Finansial', k: 'F6.1. Rp Total Penyelamatan/Recovery Aset dari Kasus Fraud', w: 10, u: 'Rp', t: '>= Target' },

      { p: 'customer', o: 'C6. Tingkat Kepuasan Internal', k: 'C6.1. SLA Tindak Lanjut Laporan Indikasi Fraud (Whistleblowing)', w: 10, u: 'Hari', t: '<= SLA' },
      { p: 'customer', o: 'C7. Persepsi Positif Masyarakat', k: 'C7.1. Pelaksanaan Sosialisasi Anti Fraud ke Eksternal/Vendor', w: 10, u: 'Kegiatan', t: '>= 4' },

      { p: 'internal_process', o: 'B8. Penguatan Kepatuhan & Manajemen Risiko', k: 'B8.1. % Penyelesaian Investigasi Fraud Sesuai SLA', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B8. Penguatan Kepatuhan & Manajemen Risiko', k: 'B8.2. % Cabang/Divisi yang Di-review (Fraud Risk Assessment)', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B7. Penyelesaian Tindak Lanjut', k: 'B7.1. % Rekomendasi Perbaikan Sistem yang Dieksekusi Manajemen', w: 10, u: '%', t: '>= 90%' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses', k: 'B6.1. Implementasi & Uptime Sistem Fraud Detection (FDS)', w: 10, u: '%', t: '>= 99%' },
      { p: 'internal_process', o: 'B4. Inovasi & Sosialisasi', k: 'B4.1. Pelaksanaan Awareness Program Anti Fraud Internal', w: 10, u: 'Kegiatan', t: '>= 12' },

      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays (Fraud Investigation/Data Analytics)', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' },
    ]
  },
  // ---------------------------------------------------------
  // 7. UNIT AUDIT INTERNAL SYARIAH
  // ---------------------------------------------------------
  {
    units: ['Unit Audit Internal Syariah'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Unit (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F6. Meminimalkan Kerugian Finansial', k: 'F6.1. Zero Kerugian Finansial akibat Denda Syariah/DPS', w: 10, u: 'Rp', t: '0' },

      { p: 'customer', o: 'C6. Tingkat Kepuasan Internal', k: 'C6.1. Indeks Kepuasan Auditee (Cabang/Unit Syariah)', w: 10, u: 'Skor', t: '>= 85' },
      { p: 'customer', o: 'C6. Tingkat Kepuasan Internal', k: 'C6.2. SLA Penerbitan Laporan Hasil Audit (LHA) Syariah', w: 10, u: 'Hari', t: '<= 14' },

      { p: 'internal_process', o: 'B7. Pengawasan & Tindak Lanjut', k: 'B7.1. % Realisasi Pelaksanaan Program Kerja Audit Tahunan (PKAT)', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B7. Pengawasan & Tindak Lanjut', k: 'B7.2. % Tindak Lanjut Temuan Audit oleh Auditee', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B8. Kepatuhan & Risiko', k: 'B8.1. Zero Temuan Berulang (Repeat Finding) Aspek Syariah', w: 10, u: 'Angka', t: '0' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses', k: 'B6.1. Penggunaan Continuous Auditing System', w: 10, u: '%', t: '>= 80%' },
      { p: 'internal_process', o: 'B4. Inovasi & Layanan', k: 'B4.1. Pemberian Advisory/Consulting Aspek Syariah ke Bisnis', w: 10, u: 'Kegiatan', t: '>= 4' },

      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays (Audit/Fiqih Muamalah)', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' },
    ]
  },
  // ---------------------------------------------------------
  // 8. UNIT KEAMANAN DAN KETAHANAN SIBER
  // ---------------------------------------------------------
  {
    units: ['Unit Keamanan dan Ketahan Siber'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Keamanan Siber (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F6. Meminimalkan Potensi Kerugian Finansial', k: 'F6.1. Zero Kerugian Finansial akibat Cyber Attack / Breach', w: 10, u: 'Rp', t: '0' },

      { p: 'customer', o: 'C5. Layanan Digital Aktif', k: 'C5.1. Zero Insiden Data Nasabah Bocor (Data Breach)', w: 10, u: 'Angka', t: '0' },
      { p: 'customer', o: 'C6. Tingkat Kepuasan Pelanggan', k: 'C6.1. SLA Respon & Eskalasi Insiden Keamanan (Incident Response)', w: 10, u: 'Menit', t: '<= 15' },

      { p: 'internal_process', o: 'B6. Digitalisasi Proses Operasional', k: 'B6.1. Pelaksanaan Penetration Testing & Vulnerability Assessment', w: 10, u: '%', t: '100% Jadwal' },
      { p: 'internal_process', o: 'B8. Penguatan Manajemen Risiko', k: 'B8.1. % Pemenuhan Standar Kematangan Siber OJK (Cyber Maturity)', w: 10, u: 'Skor', t: '>= Level 4' },
      { p: 'internal_process', o: 'B8. Penguatan Manajemen Risiko', k: 'B8.2. % Tindak Lanjut Patching/Remediasi Kerentanan Kritis', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B7. Penyelesaian Temuan', k: 'B7.1. Zero Temuan Signifikan IT Security dari Audit/OJK', w: 10, u: 'Angka', t: '0' },
      { p: 'internal_process', o: 'B4. Inovasi & Layanan', k: 'B4.1. Pelaksanaan Security Awareness Campaign Karyawan', w: 10, u: 'Kegiatan', t: '>= 4' },

      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays (CEH/CISA/Cybersecurity)', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' },
    ]
  },
  // ---------------------------------------------------------
  // 9. UNIT KEPATUHAN SYARIAH
  // ---------------------------------------------------------
  {
    units: ['Unit Kepatuhan Syariah'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Unit (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F6. Meminimalkan Potensi Kerugian Finansial', k: 'F6.1. Zero Denda OJK/Regulator Terkait Produk Syariah', w: 10, u: 'Rp', t: '0' },

      { p: 'customer', o: 'C6. Tingkat Kepuasan Internal', k: 'C6.1. SLA Pemberian Opini Kepatuhan Produk/Layanan Syariah', w: 10, u: 'Hari', t: '<= SLA' },
      { p: 'customer', o: 'C4. Optimalisasi Bisnis Syariah', k: 'C4.1. Sosialisasi Kepatuhan Syariah ke Cabang Konvensional', w: 10, u: 'Kegiatan', t: '>= 12' },

      { p: 'internal_process', o: 'B8. Penguatan Manajemen Risiko & Kepatuhan', k: 'B8.1. % Realisasi Review Kepatuhan Prinsip Syariah (DPS)', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B8. Penguatan Manajemen Risiko & Kepatuhan', k: 'B8.2. % Pelaporan Rutin Syariah ke Regulator Tepat Waktu', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B7. Penyelesaian Tindak Lanjut', k: 'B7.1. % Penyelesaian Tindak Lanjut Opini DPS', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B4. Implementasi Inisiatif Produk', k: 'B4.1. Zero Produk Syariah Baru yang Ditolak OJK', w: 10, u: 'Angka', t: '0' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses', k: 'B6.1. Pengembangan Dashboard Monitoring Kepatuhan Syariah', w: 10, u: '%', t: '100%' },

      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays (Kepatuhan/Fiqih Perbankan)', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' },
    ]
  },
  // ---------------------------------------------------------
  // 10. UNIT MANAJEMEN RISIKO SYARIAH
  // ---------------------------------------------------------
  {
    units: ['Unit Manajemen Risiko Syariah'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Unit (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F6. Meminimalkan Potensi Kerugian Finansial', k: 'F6.1. Nilai Kerugian Akibat Risiko Operasional Syariah', w: 10, u: 'Rp', t: '<= Toleransi' },

      { p: 'customer', o: 'C4. Optimalisasi Bisnis Syariah', k: 'C4.1. SLA Penerbitan Risk Assessment Produk Syariah Baru', w: 10, u: 'Hari', t: '<= SLA' },
      { p: 'customer', o: 'C6. Tingkat Kepuasan Internal', k: 'C6.1. Indeks Kepuasan Unit Bisnis terhadap Advisory Risiko', w: 10, u: 'Skor', t: '>= 85' },

      { p: 'internal_process', o: 'B8. Penguatan Manajemen Risiko & Kepatuhan', k: 'B8.1. Skor Profil Risiko Unit Usaha Syariah (UUS)', w: 10, u: 'Skor', t: 'Low/Moderate' },
      { p: 'internal_process', o: 'B8. Penguatan Manajemen Risiko & Kepatuhan', k: 'B8.2. Pelaporan Profil Risiko UUS ke Regulator Tepat Waktu', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B1. Menjaga Kualitas Aset', k: 'B1.1. Deviasi Batas Maksimum Penyaluran Dana (BMPD) Syariah', w: 10, u: 'Angka', t: '0' },
      { p: 'internal_process', o: 'B7. Penyelesaian Tindak Lanjut', k: 'B7.1. Tindak Lanjut Mitigasi Risiko dari Risk Event Database', w: 10, u: '%', t: '>= 90%' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses', k: 'B6.1. Optimalisasi Sistem Manajemen Risiko UUS (Input Data Tepat)', w: 10, u: '%', t: '100%' },

      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays (Risk Management Syariah)', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' },
    ]
  },
  // ---------------------------------------------------------
  // 11. UNIT PENGENDALIAN GRATIFIKASI
  // ---------------------------------------------------------
  {
    units: ['Unit Pengendalian Gratifikasi'],
    kpis: [
      { p: 'financial', o: 'F3. Meningkatkan Efisiensi Operasional', k: 'F3.1. % Realisasi Anggaran Unit (CIR)', w: 10, u: '%', t: '<= 100%' },
      { p: 'financial', o: 'F6. Meminimalkan Potensi Kerugian Finansial', k: 'F6.1. Nilai Gratifikasi Ilegal yang Diserahkan ke KPK/Negara', w: 10, u: 'Rp', t: '100% Penyerahan' },

      { p: 'customer', o: 'C7. Pengenalan & Persepsi Positif', k: 'C7.1. Pelaksanaan Sosialisasi Anti Gratifikasi ke Vendor/Nasabah', w: 10, u: 'Kegiatan', t: '>= 6' },
      { p: 'customer', o: 'C6. Tingkat Kepuasan Internal', k: 'C6.1. SLA Respon & Konsultasi Penerimaan Hadiah/Gratifikasi', w: 10, u: 'Hari', t: '<= 2' },

      { p: 'internal_process', o: 'B8. Penguatan Manajemen Risiko & Kepatuhan', k: 'B8.1. % Pelaporan Penerimaan Gratifikasi ke KPK Tepat Waktu', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B8. Penguatan Manajemen Risiko & Kepatuhan', k: 'B8.2. Skor Assessment Implementasi ISO 37001 (SMAP)', w: 10, u: 'Skor', t: '>= Target' },
      { p: 'internal_process', o: 'B7. Penyelesaian Tindak Lanjut', k: 'B7.1. Tindak Lanjut Laporan Gratifikasi Internal via Sistem', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B6. Digitalisasi Proses', k: 'B6.1. Pemanfaatan Aplikasi Pelaporan Gratifikasi Internal', w: 10, u: '%', t: '100%' },
      { p: 'internal_process', o: 'B5. Optimalisasi Perencanaan', k: 'B5.1. Evaluasi & Pemutakhiran Pedoman Pengendalian Gratifikasi', w: 10, u: '%', t: '100%' },

      { p: 'learning_growth', o: 'L2. Meningkatkan Kompetensi', k: 'L2.2. # Training Mandays (Anti Bribery/Compliance)', w: 5, u: 'Hari', t: '>= 5' },
      { p: 'learning_growth', o: 'L3. Budaya Perusahaan', k: 'L3.1. # Culture Implementation Index', w: 5, u: 'Skor', t: '>= 80' },
    ]
  }
];

async function seed() {
  try {
    const unitNamesToUpdate = unitsData.flatMap(g => g.units);
    console.log('🧹 Membersihkan KPI lama untuk Departemen, UKK, dan Unit...');
    for (const unit of unitNamesToUpdate) {
        await pool.query("DELETE FROM kpis WHERE unit_name = ?", [unit]);
    }

    for (const group of unitsData) {
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
        console.log(`[+] Disisipkan KPI Detail untuk ${unit} (Total Bobot: ${totalWeight}%, 4 Perspektif, Item Max 10%, L&G 5%)`);
      }
    }
    console.log('\n✅ Proses Expand KPI Departemen, UKK, Unit berhasil diselesaikan!');
  } catch (error) {
    console.error('Error saat menyisipkan data:', error);
  } finally {
    pool.end();
  }
}

seed();