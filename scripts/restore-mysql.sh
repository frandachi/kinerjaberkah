#!/usr/bin/env bash
# Restore dump MySQL Express ke database produksi
# Jalankan DI SERVER (JumpServer), dari root project kinerjaberkah.
#
#   export MYSQL_PWD='...'
#   bash scripts/restore-mysql.sh
#   # atau dump spesifik:
#   DUMP=db/pasiongo_kinerjaberkah_08-09-2026.sql bash scripts/restore-mysql.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DUMP="${DUMP:-$ROOT/db/pasiongo_kinerjaberkah_08-09-2026.sql}"

# Izinkan path relatif dari cwd
if [[ ! -f "$DUMP" && -f "$ROOT/$DUMP" ]]; then
  DUMP="$ROOT/$DUMP"
fi

MYSQL_HOST="${DB_HOST:-10.30.253.13}"
MYSQL_PORT="${DB_PORT:-3306}"
MYSQL_USER="${DB_USER:-kpi_user}"
MYSQL_DB="${DB_NAME:-kpi_corporate}"

if [[ ! -f "$DUMP" ]]; then
  echo "ERROR: dump tidak ditemukan: $DUMP"
  exit 1
fi

if [[ -z "${MYSQL_PWD:-}" ]]; then
  echo "Set dulu: export MYSQL_PWD='...'"
  exit 1
fi

command -v mysql >/dev/null || { echo "mysql client tidak ada. Install mysql-client."; exit 1; }

echo "==> Dump: $DUMP"
echo "==> Cek koneksi $MYSQL_USER@$MYSQL_HOST:$MYSQL_PORT"
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -e "SELECT VERSION();"

echo "==> Pastikan database $MYSQL_DB"
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -e \
  "CREATE DATABASE IF NOT EXISTS \`${MYSQL_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"

echo "==> Restore (DROP TABLE + data — data lama di $MYSQL_DB akan diganti)"
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DB" < "$DUMP"

echo "==> Pastikan kolom MFA wajib (aman jika sudah ada)"
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DB" < "$ROOT/server/migrations/005_mfa_required.sql" || true

echo "==> Cek tabel"
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DB" -e "SHOW TABLES;"
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DB" -e \
  "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM kpis) AS kpis, (SELECT COUNT(*) FROM pegawai) AS pegawai;"

echo "Selesai restore ke ${MYSQL_DB}."
echo "Login dump: username superadmin (npp ADMIN)."
