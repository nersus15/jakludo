# 🚀 Panduan Deployment JakLudo di Ubuntu Server

Panduan lengkap untuk men-deploy aplikasi **JakLudo** menggunakan Docker dan Docker Compose di server berbasis **Ubuntu (20.04 / 22.04 / 24.04 LTS)**.

---

## 1. Persiapan Server Ubuntu

Login ke server Ubuntu kamu melalui terminal SSH:
```bash
ssh user@ip-server-kamu
```

### A. Update Paket Sistem
```bash
sudo apt update && sudo apt upgrade -y
```

### B. Install Docker & Docker Compose Plugin
Jalankan perintah berikut untuk menginstal Docker resmi:
```bash
# Hapus paket lama jika ada
sudo apt remove -y docker docker-engine docker.io containerd runc

# Install dependensi yang dibutuhkan
sudo apt install -y ca-certificates curl gnupg lsb-release

# Tambahkan GPG key resmi Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Tambahkan repositori Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine & Compose
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Berikan izin ke user saat ini (opsional agar tidak perlu sudo setiap saat)
sudo usermod -aG docker $USER
newgrp docker
```

Verifikasi instalasi:
```bash
docker --version
docker compose version
```

---

## 2. Deploy Aplikasi JakLudo

### A. Salin / Clone Repositori ke Server
```bash
git clone <url-repository-kamu> /opt/jakludo
cd /opt/jakludo
```
*(Atau upload folder proyek `ludo-party` menggunakan `scp` / `rsync` / SFTP ke server).*

### B. Konfigurasi Container PostgreSQL & Migrasi Otomatis dari SQLite

File [`docker-compose.yml`](docker-compose.yml) sudah menyertakan container **`jakludo-postgres`** (`postgres:17-alpine`) yang terisolasi khusus untuk JakLudo:
- **Bebas bentrok dengan PostgreSQL lain di server**: Container `jakludo-app` terhubung ke `postgres:5432` lewat jaringan internal Docker, sedangkan ke host Ubuntu dipetakan di `127.0.0.1:5433` (bukan `5432`) sehingga **tidak akan bentrok** dengan PostgreSQL lain yang sudah berjalan di server kamu.
- **Hemat RAM**: Dikonfigurasi dengan `shared_buffers=64MB` dan `max_connections=50`.
- **Data persisten**: Disimpan di Docker named volume `jakludo_pgdata`.

1. Siapkan file `.env` di folder `/opt/jakludo`:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Isi minimal:
   ```env
   TRUST_PROXY=1
   POSTGRES_USER=jakludo
   POSTGRES_PASSWORD=PasswordKuatJakLudo123!
   POSTGRES_DB=jakludo
   POSTGRES_PORT=5433

   # Konfigurasi MinIO S3 (sudah tersedia di server, tanpa container tambahan)
   S3_ENDPOINT=https://s3.domainkamu.com
   S3_PUBLIC_ENDPOINT=https://s3.domainkamu.com
   S3_ACCESS_KEY=AKIA_ACCESS_KEY_KAMU
   S3_SECRET_KEY=SECRET_KEY_KAMU
   S3_BUCKET=jakludo
   S3_REGION=us-east-1
   S3_FORCE_PATH_STYLE=true
   ```
   > **Catatan Bucket MinIO**: Buat bucket bernama `jakludo` (biarkan **private**, tidak perlu *public anonymous access* karena server menggunakan *Presigned URL*). Pastikan CORS di MinIO mengizinkan method `GET` dan `HEAD` dari domain JakLudo kamu.

2. Pastikan izin folder `server/data` dapat diakses oleh container (`uid 1000`) agar file SQLite lama (`jakludo.db`) bisa dibaca dan di-backup:
   ```bash
   mkdir -p server/data
   sudo chown -R 1000:1000 server/data
   ```

3. **Migrasi Otomatis dari `jakludo.db` (SQLite) ke PostgreSQL**:
   Saat container `jakludo-app` pertama kali menyala setelah `jakludo-postgres` berstatus *healthy*:
   - Modul [`server/migrate.js`](server/migrate.js) otomatis menerapkan seluruh skema tabel di `server/migrations/*.sql`.
   - Jika terdapat file `server/data/jakludo.db` dari versi sebelumnya, seluruh data (`users`, `user_items`, `sessions`, `leaderboard`, dan `rooms` aktif) otomatis dipindahkan ke PostgreSQL dalam satu transaksi, lalu file lama diubah namanya menjadi `jakludo.db.migrated-<waktu>` sebagai cadangan aman.

### C. Build & Jalankan Container
Cukup jalankan satu perintah:
```bash
docker compose up -d --build
```

Container akan otomatis:
1. Menjalankan container `jakludo-postgres` dan menunggu hingga *healthy*.
2. Mem-build frontend Vite (React) dan image `jakludo-app`.
3. Menjalankan migrasi skema & migrasi data `jakludo.db` ke PostgreSQL, serta memulihkan room yang sedang berjalan.
4. Menjalankan server `jakludo-app` di port `5172`.

Verifikasi status migrasi kapan saja dengan:
```bash
docker compose exec jakludo npm run db:status
```

---

## 3. Memeriksa Status Aplikasi

### Cek Status Container:
```bash
docker compose ps
```
Hasil status harus menunjukkan `Up (healthy)`.

### Cek Log Realtime:
```bash
docker compose logs -f
```

### Tes Akses Lokal Server:
```bash
curl http://localhost:5172/health
# Respon: {"ok":true,"rooms":0}
```

Sekarang kamu sudah bisa mengakses game di browser melalui: `http://ip-server-kamu:5172/`.

---

## 4. Konfigurasi Nginx & SSL HTTPS (Domain Publik)

Untuk menghubungkan domain publik (misal: `jakludo.com`) dan mengaktifkan HTTPS serta WebSocket (WSS):

### A. Install Nginx & Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### B. Konfigurasi Nginx Reverse Proxy
Buat file konfigurasi Nginx:
```bash
sudo nano /etc/nginx/sites-available/jakludo
```

Salin konfigurasi berikut (ganti `domainkamu.com` dengan domain milikmu):
```nginx
server {
    server_name domainkamu.com;

    location / {
        proxy_pass http://127.0.0.1:5172;
        proxy_http_version 1.1;

        # Konfigurasi WebSocket Socket.io yang wajib ada
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Header klien
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Buffer & Timeout untuk game realtime
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Aktifkan konfigurasi dan reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/jakludo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### C. Pasang Sertifikat SSL Gratis (Let's Encrypt)
```bash
sudo certbot --nginx -d domainkamu.com
```
Certbot akan otomatis mengamankan domain kamu dengan SSL/TLS (HTTPS).

### D. Aktifkan TRUST_PROXY
Karena semua request kini datang dari Nginx, set `TRUST_PROXY=1` agar batas percobaan login dihitung per IP pemain (bukan IP Nginx). Buat file `.env` di folder proyek:
```bash
echo "TRUST_PROXY=1" > .env
docker compose up -d
```
Jika memakai Nginx, sebaiknya port 5172 tidak dibuka ke publik (firewall), supaya header `X-Forwarded-For` tidak bisa dipalsukan.

---

## 4b. Jika Memakai Tunnel (Cloudflare Tunnel, ngrok, dll.)

- **WebSocket wajib aktif di tunnel.** Klien mencoba WebSocket lebih dulu dan baru memakai HTTP long-polling sebagai cadangan. Polling lewat tunnel jauh lebih rentan putus. Di Cloudflare: *Network → WebSockets: On*.
- **Set `TRUST_PROXY=1`.** Semua request datang dari daemon tunnel, jadi tanpa ini semua pemain dianggap satu IP dan batas login/registrasi berlaku untuk seluruh situs sekaligus.
- **Jangan menjalankan lebih dari satu instance/replika.** Room disimpan di memori proses. Kalau ada dua instance, pemain di room yang sama bisa terhubung ke proses berbeda dan "hilang" dari room.

### Melacak pemain yang terputus
Server mencatat setiap koneksi dan alasan putusnya:
```bash
docker compose logs --since 2h | grep "\[conn\]"
```
Contoh:
```
[conn] disconnect id=... transport=websocket device=mobile room=AB12C player="Budi" reason="ping timeout" after=312s
```
| `reason` | Arti |
| :--- | :--- |
| `ping timeout` | HP tidur, tab di background, atau jaringan beku lebih dari ±55 detik |
| `transport close` / `transport error` | Koneksi diputus di tengah jalan oleh tunnel, proxy, atau jaringan |
| `client namespace disconnect` | Pemain sengaja menutup koneksi |
| `server shutting down` | Server di-restart |

Kalau `transport` di log sering bernilai `polling`, berarti WebSocket tidak lolos lewat tunnel. Itu yang pertama perlu dibereskan.

Pemain yang terputus otomatis menyambung ulang ke kursinya. Kursi di lobby ditahan 2 menit, dan saat permainan berjalan gilirannya dimainkan sistem setelah 8 detik tanpa langsung dinyatakan OUT.

---

## 5. Perintah Berguna untuk Maintenance

| Aksi | Perintah |
| :--- | :--- |
| **Stop Aplikasi** | `docker compose down` |
| **Restart Aplikasi** | `docker compose restart` |
| **Update / Rebuild Kode Terbaru** | `git pull && docker compose up -d --build` |
| **Melihat Log** | `docker compose logs -f --tail=100` |
| **Cek Status Migrasi PostgreSQL** | `docker compose exec jakludo npm run db:status` |
| **Masuk ke Shell psql** | `docker compose exec postgres psql -U ${POSTGRES_USER:-jakludo} -d ${POSTGRES_DB:-jakludo}` |
| **Backup Database PostgreSQL (aman saat server berjalan)** | `docker compose exec jakludo npm run backup` → `server/data/backups/jakludo-pg-<waktu>.sql` |
| **Restore Database PostgreSQL** | `docker compose exec -T postgres psql -U ${POSTGRES_USER:-jakludo} -d ${POSTGRES_DB:-jakludo} < server/data/backups/jakludo-pg-<waktu>.sql` |

---

## 6. Monster Quiz Battle (Migrasi, Seed & Konfigurasi)

Monster Quiz Battle terintegrasi langsung di proses JakLudo yang sama tanpa kontainer baru:
- **Migrasi Skema (`009_monster_quiz.sql`)**: Dijalankan otomatis saat server start (`hydrateFromPostgres`) atau manual via `npm run db:migrate`. Membuat tabel `quiz_monsters`, `quiz_questions`, `quiz_rooms`, `quiz_room_players`, `quiz_matches`, `quiz_match_players`, `quiz_rounds`, `quiz_answers`, dan `quiz_player_stats` dengan foreign key ke tabel `users`.
- **Seed Otomatis**: 6 monster elemen (`emberon`, `aquaris`, `terragon`, `voltix`, `sylvara`, `frostbite`) dan 64 bank soal tervalidasi (32 Pengetahuan Umum + 32 Hitung-hitungan Cepat) di-seed secara idempoten saat aplikasi menyala.
- **Variabel Lingkungan Opsional (Admin Bank Soal)**:
  - `QUIZ_ADMIN_USERNAMES=admin1,admin2` — daftar username yang diizinkan mengelola bank soal via `/api/quiz/questions`.
  - `QUIZ_ADMIN_KEY=rahasia-admin` — kunci header `X-Quiz-Admin-Key` alternatif untuk endpoint manajemen soal.


