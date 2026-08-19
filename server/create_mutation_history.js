const db = require('./db');

async function createMutationHistoryTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS mutation_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pegawai_id VARCHAR(100) NOT NULL,
      npp VARCHAR(50) NOT NULL,
      employee_name VARCHAR(255) NOT NULL,
      
      -- Unit asal
      old_unit_name VARCHAR(255) NOT NULL,
      old_jabatan VARCHAR(255) NOT NULL,
      old_unit_type VARCHAR(50),
      
      -- Unit tujuan
      new_unit_name VARCHAR(255) NOT NULL,
      new_jabatan VARCHAR(255) NOT NULL,
      new_unit_type VARCHAR(50),
      
      -- Tanggal efektif mutasi
      effective_date DATE NOT NULL,
      
      -- Periode split (untuk perhitungan)
      old_period_start DATE NOT NULL,
      old_period_end DATE NOT NULL,
      new_period_start DATE NOT NULL,
      new_period_end DATE NOT NULL,
      
      -- KPI tracking
      old_kpi_ids JSON COMMENT 'Array of KPI IDs from old unit',
      new_kpi_ids JSON COMMENT 'Array of KPI IDs from new unit',
      
      -- Status
      status ENUM('active', 'completed') DEFAULT 'active',
      
      -- Metadata
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_pegawai_id (pegawai_id),
      INDEX idx_effective_date (effective_date),
      INDEX idx_npp (npp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  try {
    await db.query(sql);
    console.log('✅ Table mutation_history created successfully');
  } catch (error) {
    console.error('❌ Error creating mutation_history table:', error.message);
    throw error;
  }
}

// Run migration
createMutationHistoryTable()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
