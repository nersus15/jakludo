# JakLudo — React + Socket.IO

Game Ludo multiplayer realtime dengan React/Vite di sisi klien dan Node/Express/Socket.IO di sisi server. Room dibuat oleh server dan undangan memakai URL `?room=KODEROOM`. Satu room maksimal 4 pemain (manusia atau bot).

## Menjalankan secara lokal

Butuh Node.js 22.13+ (memakai `node:sqlite` bawaan Node, tanpa dependency native).

```bash
npm ci
npm run dev
```

Buka http://localhost:5173. Untuk mencoba multiplayer, buka URL yang sama di beberapa profil browser atau perangkat.

## Test

```bash
npm test
```

Test memakai `node:test`: aturan main di `server/rules.test.js` dan integration test socket/HTTP di `server/server.test.js`. Test memakai folder data sementara, sehingga data di `server/data` tidak tersentuh.

## Production

```bash
npm run build
npm start
```

Server melayani folder `dist` dan Socket.IO pada `PORT` (default 5172). Panduan Docker + Nginx ada di [DEPLOYMENT.md](DEPLOYMENT.md).

Variabel lingkungan:

| Variabel | Default | Kegunaan |
| :--- | :--- | :--- |
| `PORT` | `5172` | Port HTTP/Socket.IO |
| `TRUST_PROXY` | `0` | Set `1` jika di belakang Nginx agar rate limit login memakai IP asli |
| `CORS_ORIGIN` | kosong | Daftar origin (dipisah koma) bila klien di-host di domain lain |
| `JAKLUDO_DATA_DIR` | `server/data` | Folder database SQLite (`jakludo.db`) |

## Arsitektur singkat

- `server/rules.js`: aturan main murni (gerak bidak, safe zone, pilihan bot). Server juga mengirim daftar bidak yang boleh jalan (`room.movable`) ke klien, jadi aturan hanya ada di satu tempat.
- `server/index.js`: room, giliran, timer, event Socket.IO, dan REST API (auth, leaderboard, toko).
- `server/db.js`: user, sesi (token disimpan sebagai hash), leaderboard, inventaris, dan snapshot room di SQLite (`server/data/jakludo.db`, mode WAL). Data JSON versi lama dipindahkan otomatis saat pertama kali start.
- `server/backup.js`: backup database tanpa menghentikan server (`npm run backup`).

Room aktif berjalan di memori dan disimpan sebagai snapshot ke SQLite setiap ada perubahan, sehingga restart atau deploy ulang tidak menghapus permainan. Pemain tinggal tersambung ulang ke kursinya. Siklus hidup room:
- Lobby tanpa pemain yang tersambung dihapus setelah 5 menit. Kursi pembuat room ditahan selama room masih ada, kursi pemain lain ditahan 2 menit.
- Permainan yang sedang berjalan hanya dihapus jika semua pemain manusia sudah OUT.
- Permainan yang selesai dihapus 5 menit kemudian (memberi waktu untuk "Main Lagi").

Untuk menjalankan lebih dari satu instance, dibutuhkan adapter Socket.IO bersama dan penyimpanan room terpusat.
