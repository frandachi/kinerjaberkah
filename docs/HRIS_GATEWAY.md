# Integrasi HRIS API Gateway

Dokumentasi integrasi Kinerja Berkah dengan API Gateway HRIS untuk **login** dan **sinkronisasi pegawai**.

## Ringkasan

| Fitur | Endpoint app | Endpoint gateway |
| --- | --- | --- |
| Login | `POST /api/auth/login` | `POST /hris/authLogin` |
| Sync pegawai | `POST /api/pegawai/sync-hris` | `POST /hris/inqMasterPegawaiByKondisi` |

Alur login: **HRIS dulu** → jika gagal/timeout/`rcode != 00` → **fallback password lokal** → lanjut MFA (challenge atau enroll).

Role:

- User baru dari HRIS → `role = user`
- Update dari sync/login → **tidak mengubah** `role`
- Ubah role hanya lewat `PUT /api/users/:id` (superadmin)

## File terkait

- [`server/lib/hris-gateway.js`](../server/lib/hris-gateway.js) — HTTP client + header dinamis
- [`server/lib/hris-upsert.js`](../server/lib/hris-upsert.js) — mapping & upsert `pegawai` / `users`
- [`server/routes/auth.js`](../server/routes/auth.js) — login HRIS-first
- [`server/routes/pegawai.js`](../server/routes/pegawai.js) — `sync-hris`
- [`server/routes/users.js`](../server/routes/users.js) — guard role saat update
- Referensi PHP: `ServiceHelper.php` (smart-graha) — pola timestamp & HMAC client-secret

## Konfigurasi env

Isi di `server/.env` (lihat template `server/.env.example`):

```env
HRIS_BASE_URL=http://192.168.3.196:8077
HRIS_CLIENT_IP=192.168.3.13
HRIS_API_KEY=...
HRIS_CLIENT_ID=17
HRIS_CLIENT_KEY=...
HRIS_TIMEOUT_MS=10000
```

| Variabel | Keterangan |
| --- | --- |
| `HRIS_BASE_URL` | Base URL gateway (tanpa trailing slash) |
| `HRIS_API_KEY` | `X-Api-Key` |
| `HRIS_CLIENT_ID` | `X-Client-Id` |
| `HRIS_CLIENT_KEY` | Kunci HMAC untuk `X-Client-Secret` (setara `CLIENT_KEY` di PHP) |
| `HRIS_CLIENT_IP` | Jika terisi, ikut di string HMAC (`CLIENT_ID&API_KEY&IP&timestamp`) |
| `HRIS_TIMEOUT_MS` | Timeout request (default 10000) |

**Jangan** set `HRIS_SIGNATURE` / `HRIS_TIMESTAMP` / `HRIS_CLIENT_SECRET` di env — nilai itu digenerate per request.

`HRIS_AUTH_KEY` lama (endpoint `192.168.3.90`) tidak dipakai endpoint gateway baru.

Setelah ubah env di server:

```bash
cd /home/services/kinerjaberkah/server   # atau path app
# pastikan .env sudah berisi HRIS_*
pm2 restart kinerjaberkah   # sesuaikan nama proses
```

## Header request (dinamis)

Setiap POST ke gateway:

| Header | Sumber |
| --- | --- |
| `Content-Type` | `application/json` |
| `X-Api-Key` | `HRIS_API_KEY` |
| `X-Client-Id` | `HRIS_CLIENT_ID` |
| `X-Timestamp` | `Y-m-d H:i:s` + `.` + 6 karakter (pola PHP `microtime`) |
| `X-Client-Secret` | `base64(HMAC-SHA256(plain, HRIS_CLIENT_KEY))` |
| `X-Signature` | string kosong `''` (implementasi signature belakangan) |

Plain untuk client-secret:

```text
{CLIENT_ID}&{API_KEY}&{CLIENT_IP}&{timestamp}
```

(`&{CLIENT_IP}` hanya jika `HRIS_CLIENT_IP` non-empty.)

## Body gateway

### authLogin

`userId` / `password` memakai **AES-256-CBC** seperti `ServiceHelper::encrypted` (bukan Base64 plain):

1. Key = 32 karakter pertama `HRIS_CLIENT_KEY`
2. IV random 16 byte + ciphertext
3. `base64(base64(iv || cipher))` (double base64)

```json
{
  "reqid": "HR001",
  "userId": "<aes-encrypted>",
  "password": "<aes-encrypted>"
}
```

Sukses: `rcode === "00"`; data pegawai di `data` (atau `result`).

Jika salah kirim Base64 plain, gateway log: `decrypted Error ... Incorrect IV length` dan `nama_login: None`.

### inqMasterPegawaiByKondisi

```json
{
  "reqid": "HR006",
  "kondisi": ""
}
```

`kondisi` kosong = ambil master sesuai kontrak gateway.

## Mapping field

| HRIS | `pegawai` | `users` |
| --- | --- | --- |
| `nrik` | `npp` | `npp` |
| `nama` | `name` | `name` |
| `nm_jabatan` / `jabdef` | `jabatan` | `jabatan` |
| `nm_unit_kerja` / `ukerdef` | `unit_name` | `unit_name` |
| `nama_login` | — | `username` (fallback `nrik`) |

Lookup stabil by **`npp` (= `nrik`)**.

Pada login HRIS sukses, password lokal di-update ke bcrypt dari password yang diketik (agar fallback lokal tetap relevan). Role tidak ditulis ulang.

User baru dari sync tanpa password plain: password awal = bcrypt(`npp`) sampai login HRIS pertama.

## Alur login

```text
UI → POST /api/auth/login (username, password, captcha)
  → captcha valid?
  → authLogin gateway
      OK  → upsert pegawai + ensure user → MFA gate
      FAIL → SELECT users by username/npp + verifyPassword lokal → MFA gate
  → requires2FA | requiresMFASetup | (setelah MFA) JWT
```

MFA tidak di-bypass.

## Sync pegawai (admin / superadmin)

```http
POST /api/pegawai/sync-hris
Authorization: Bearer <token>
```

Response contoh:

```json
{
  "message": "Sinkronisasi berhasil",
  "inserted": 10,
  "updated": 200,
  "usersCreated": 8
}
```

## Uji di server app

1. Pastikan server bisa reach `192.168.3.196:8077`.
2. Set env HRIS, restart PM2.
3. Login dengan akun HRIS valid → MFA → dashboard.
4. Login `superadmin` lokal saat gateway down → tetap masuk (fallback).
5. Jalankan sync sebagai admin → pegawai bertambah; user baru `role=user`; role lama tidak berubah.
6. Superadmin ubah role di menu pengguna → sync ulang tidak mereset role.

## Troubleshooting

| Gejala | Cek |
| --- | --- |
| Log `HRIS authLogin fallback to local` | Network, env, `rcode`, format body Base64 |
| Gateway connection / timeout | Firewall dari `192.168.3.13` ke `:8077` |
| `rcode` bukan `00` | Kredensial user HRIS / API key / client id & key |
| Signature ditolak gateway | Saat ini `X-Signature` sengaja kosong; aktifkan HMAC signature jika gateway mewajibkan |

## Catatan lanjutan

- Port `getSignature` (HMAC atas `clientSecret + '&' + json payload`) mengikuti PHP `ServiceHelper::getSignature` bila gateway mulai mewajibkan signature.
- Encoding body login: AES double-base64 (`encryptCredential`), sama pola smart-graha `ServiceHelper::encrypted`.
