async function buildJabatanUnitScope(db, jabatan, unit_name) {
  const [pegawaiKpis] = await db.query(
    "SELECT id FROM kpis WHERE jabatan = ? AND unit_name = ? AND unit_type = 'pegawai' LIMIT 1",
    [jabatan, unit_name]
  );

  if (pegawaiKpis.length > 0) {
    return {
      where: "jabatan = ? AND unit_name = ? AND unit_type = 'pegawai'",
      params: [jabatan, unit_name],
    };
  }

  return {
    where: 'jabatan = ? AND unit_name = ?',
    params: [jabatan, unit_name],
  };
}

module.exports = { buildJabatanUnitScope };
