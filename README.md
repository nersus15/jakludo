# JakLudo — React + Socket.IO

Game Ludo multiplayer realtime dengan React/Vite di sisi klien dan Node/Express/Socket.IO di sisi server. Room dibuat oleh server dan undangan memakai URL `?room=KODEROOM`. Satu room maksimal 4 pemain (manusia atau bot).

## Menjalankan secara lokal

Butuh Node.js 20+.

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
| `JAKLUDO_DATA_DIR` | `server/data` | Lokasi file data JSON |

## Arsitektur singkat

- `server/rules.js`: aturan main murni (gerak bidak, safe zone, pilihan bot). Server juga mengirim daftar bidak yang boleh jalan (`room.movable`) ke klien, jadi aturan hanya ada di satu tempat.
- `server/index.js`: room, giliran, timer, event Socket.IO, dan REST API (auth, leaderboard, toko).
- `server/db.js`: user, sesi, leaderboard, dan inventaris. Data disimpan di memori dan ditulis ke file JSON secara atomic (ditunda ±200 ms, dan langsung ditulis saat server berhenti).

Room disimpan di memori: restart server menghapus room yang sedang berjalan. Untuk menjalankan lebih dari satu instance, dibutuhkan adapter Socket.IO bersama dan penyimpanan room yang persisten.
