const mysql = require('mysql2/promise');

async function check() {
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

  const placeholders = dummyNames.map(() => '?').join(',');
  const [rows] = await connection.query(
    `SELECT DISTINCT jabatan, unit_name FROM kpis WHERE name IN (${placeholders}) ORDER BY jabatan`,
    dummyNames
  );

  console.log(`Ditemukan ${rows.length} kombinasi jabatan-unit yang masih menggunakan data dummy.`);
  
  // Group by jabatan
  const byJabatan = {};
  rows.forEach(r => {
    if (!byJabatan[r.jabatan]) byJabatan[r.jabatan] = [];
    if (!byJabatan[r.jabatan].includes(r.unit_name)) {
        byJabatan[r.jabatan].push(r.unit_name);
    }
  });

  const jabatans = Object.keys(byJabatan);
  console.log(`\nAda ${jabatans.length} Jabatan yang masih memiliki KPI Dummy:`);
  jabatans.forEach(j => {
    const units = byJabatan[j];
    const unitStr = units.length > 3 ? `${units.slice(0,3).join(', ')} dan ${units.length - 3} unit lainnya` : units.join(', ');
    console.log(`- ${j} (di unit: ${unitStr})`);
  });

  await connection.end();
}

check().catch(console.error);