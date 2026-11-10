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

```
server/
  index.js            bootstrap: Express, Socket.IO, restore room, shutdown
  db.js               SQLite: user, sesi (token di-hash), leaderboard, stok item, snapshot room
  backup.js           backup database tanpa menghentikan server (npm run backup)
  http/routes.js      REST API: auth, leaderboard, room aktif, toko
  realtime/socket.js  event Socket.IO -> aksi lobby/engine
  game/
    config.js         semua angka waktu & batas permainan
    rules.js          aturan main murni (gerak bidak, safe zone, pilihan bot)
    store.js          state room, broadcast ke klien, snapshot, siklus hidup room
    lobby.js          buat room, join/reconnect, bot, pemain keluar/terputus
    engine.js         giliran, dadu, langkah bidak, pemakaian item, keputusan perisai
    inventory.js      stok item per pemain (milik akun vs gratis dari pertandingan)
  items/
    index.js          registry & kontrak item
    *.js              satu file per item toko
```

Server mengirim daftar bidak yang boleh jalan (`room.movable`) dan katalog item (`/api/shop/items`) ke klien, jadi aturan dan item hanya didefinisikan di satu tempat.

### Menambah item toko baru

1. Buat file baru di `server/items/`, misalnya `double-dice.js`, yang meng-export definisi item: data toko (`id`, `name`, `icon`, `price`, `description`), `kind` (`active` / `passive` / `reactive`), lalu:
   - `use(ctx)` untuk item aktif (dipakai lewat tombol, sebelum melempar dadu), opsional `target: 'opponentPawn'`, `canUse(ctx)`, dan `attack: 'forceReturn'` jika serangannya boleh ditahan perisai lawan;
   - `hooks` untuk item pasif yang bereaksi otomatis pada event permainan (`capture`, `blackHole`);
   - `protects` + `protect(ctx)` untuk item reaktif: saat event di `protects` (`forceReturn`, `blackHole`) mengenai bidak pemiliknya, pemain mendapat popup untuk memakai item atau tidak (bot dan pemain terputus otomatis memakai, waktu habis juga berarti dipakai).
   Kontrak lengkap dan helper yang tersedia di `ctx` ada di komentar `server/items/index.js`.
2. Daftarkan di array `ITEMS` pada `server/items/index.js`.

Toko, inventaris, tombol pemakaian, dan stok di database ikut menyesuaikan tanpa mengubah file lain. Kalau item butuh event permainan baru, tambahkan satu pemanggilan `runItemHooks(room, player, '<event>', data)` di `server/game/engine.js`.

Room aktif berjalan di memori dan disimpan sebagai snapshot ke SQLite setiap ada perubahan, sehingga restart atau deploy ulang tidak menghapus permainan. Pemain tinggal tersambung ulang ke kursinya. Siklus hidup room:
- Lobby tanpa pemain yang tersambung dihapus setelah 5 menit. Kursi pembuat room ditahan selama room masih ada, kursi pemain lain ditahan 2 menit.
- Permainan yang sedang berjalan hanya dihapus jika semua pemain manusia sudah OUT.
- Permainan yang selesai dihapus 5 menit kemudian (memberi waktu untuk "Main Lagi").

Untuk menjalankan lebih dari satu instance, dibutuhkan adapter Socket.IO bersama dan penyimpanan room terpusat.
