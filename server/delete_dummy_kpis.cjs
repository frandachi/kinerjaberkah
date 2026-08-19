const mysql = require('mysql2/promise');

async function deleteDummyKpis() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kpi_corporate'
  });

  const dummyNames = [
    'Pertumbuhan Laba Bersih / Pendapatan',
    'Pertumbuhan Dana Pihak Ketiga (DPK)',
    'Indeks Kepuasan Nasabah (CSI)',
    'Tingkat Kepatuhan & Zero Fraud',
    'Pencapaian O/S Kredit / Pembiayaan Baru',
    'Akuisisi Nasabah Baru',
    'Penyelesaian NPL / Kredit Bermasalah',
    'Kunjungan / Pipeline Nasabah',
    'Akurasi Transaksi (Zero Error)',
    'SLA Pelayanan Nasabah',
    'Jumlah Transaksi / Dokumen yang Diproses',
    'Jam Pelatihan Kompetensi'
  ];

  try {
    console.log('Menghapus data KPI dummy...');
    
    // Begin transaction for safety
    await connection.beginTransaction();

    const placeholders = dummyNames.map(() => '?').join(',');
    const [result] = await connection.query(
      `DELETE FROM kpis WHERE name IN (${placeholders})`,
      dummyNames
    );

    await connection.commit();
    console.log(`✅ Berhasil menghapus ${result.affectedRows} baris KPI dummy dari database.`);
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Terjadi kesalahan saat menghapus data:', error);
  } finally {
    await connection.end();
  }
}

deleteDummyKpis();