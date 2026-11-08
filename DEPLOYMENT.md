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

### B. Pastikan Izin Folder Data
Folder `server/data/` digunakan untuk menyimpan database lokal pemain (`users.json`, `sessions.json`, `leaderboard.json`). File-file ini **tidak** ikut di repository git. Container berjalan sebagai user non-root `node` (uid 1000), jadi folder ini harus bisa ditulis oleh uid 1000:
```bash
mkdir -p server/data
sudo chown -R 1000:1000 server/data
```

Jika file data rusak, server sengaja **menolak start** (pesan `[DB FATAL]` di log) dan menyimpan salinan `*.corrupt-<waktu>`. Pulihkan dari backup lalu jalankan ulang. Ini mencegah data pemain tertimpa kosong.

### C. Build & Jalankan Container
Cukup jalankan satu perintah:
```bash
docker compose up -d --build
```

Container akan otomatis:
1. Mem-build frontend Vite (React).
2. Memasang dependensi produksi Express & Socket.io.
3. Menjalankan container `jakludo-app` di port `5172`.
4. Mem-mount volume database `./server/data` sehingga data pemain tidak akan hilang saat container di-restart.

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

## 5. Perintah Berguna untuk Maintenance

| Aksi | Perintah |
| :--- | :--- |
| **Stop Aplikasi** | `docker compose down` |
| **Restart Aplikasi** | `docker compose restart` |
| **Update / Rebuild Kode Terbaru** | `git pull && docker compose up -d --build` |
| **Melihat Log** | `docker compose logs -f --tail=100` |
| **Backup Database Data Pemain** | `tar -czvf backup-jakludo-$(date +%F).tar.gz server/data/` |

