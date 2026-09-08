# Restore MySQL — dump terbaru

Dump: `db/pasiongo_kinerjaberkah_08-09-2026.sql`  
Sumber: Navicat MySQL 8.0.46, schema `pasiongo_kinerjaberkah` (08 Sep 2026).

## Ringkasan dump

| Item | Nilai |
| --- | --- |
| Ukuran | ~14.3 MB |
| Format | Navicat, `DROP TABLE` + `CREATE` + `INSERT` |
| `CREATE DATABASE` / `USE` | Tidak ada — target DB dipilih di command line |
| Tabel | `activity_logs`, `kpi_team_comments`, `kpis`, `maker_checker`, `master_kpis`, `mutation_history`, `objectives`, `password_history`, `pegawai`, `satuans`, `strategies`, `targets`, `users` |
| User rows | ~2723 |
| MFA di dump | `totp_secret`, `totp_enabled` (belum `mfa_enrolled_at`) |

Target produksi (sama config sebelumnya):

- Host: `10.30.253.13:3306`
- DB: `kpi_corporate`
- User: `kpi_user`

Dump **menghapus** tabel lama di DB target lalu isi ulang. Backup dulu jika ada data yang harus disimpan.

## Di server (JumpServer / console)

```bash
cd /home/services/kinerjaberkah
git pull origin feature/mfa   # atau branch yang dipakai

# pastikan file dump sudah ada di server
ls -lh db/pasiongo_kinerjaberkah_08-09-2026.sql

export DB_HOST=10.30.253.13 DB_USER=kpi_user DB_NAME=kpi_corporate
export MYSQL_PWD='...'   # password kpi_user

bash scripts/restore-mysql.sh
```

Manual:

```bash
export MYSQL_PWD='...'
mysql -h 10.30.253.13 -P 3306 -u kpi_user kpi_corporate < db/pasiongo_kinerjaberkah_08-09-2026.sql
mysql -h 10.30.253.13 -P 3306 -u kpi_user kpi_corporate < server/migrations/005_mfa_required.sql
mysql -h 10.30.253.13 -P 3306 -u kpi_user kpi_corporate -e \
  "SELECT COUNT(*) users FROM users; SELECT COUNT(*) kpis FROM kpis; SELECT COUNT(*) pegawai FROM pegawai;"
```

Port 3306 biasanya hanya dari localhost server — restore dari mesin app `192.168.3.13`, bukan dari laptop.

## Setelah restore

1. `pm2 restart kinerjaberkah --update-env`
2. `curl -s http://127.0.0.1:3001/api/health` → `"db":"connected"`
3. Login UI: **`superadmin`** (npp `ADMIN`) — password sesuai dump
4. MFA wajib: akun yang `totp_enabled=0` akan diminta enroll QR saat login
