# JakLudo — React + Socket.IO

Game Ludo multiplayer realtime dengan React/Vite di sisi klien dan Node/Express/Socket.IO di sisi server. Room dibuat oleh server dan undangan memakai URL `?room=KODEROOM`. Satu room maksimal 4 pemain (manusia atau bot).

## Menjalankan secara lokal

Butuh Node.js 20+ dan PostgreSQL (opsional untuk test lokal, wajib untuk produksi lewat `DATABASE_URL`).

```bash
npm ci
cp .env.example .env
# Sesuaikan DATABASE_URL di .env, lalu jalankan migrasi:
npm run db:migrate
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
| `DATABASE_URL` | kosong | URL koneksi PostgreSQL (`postgresql://user:pass@host:5432/jakludo`) |
| `PGSSLMODE` | kosong | Set `require` atau `verify-full` jika PostgreSQL mewajibkan koneksi SSL |
| `JAKLUDO_DATA_DIR` | `server/data` | Folder data untuk backup & sumber migrasi otomatis `jakludo.db` lama |

## Migrasi Database (SQLite -> PostgreSQL)

Saat pertama kali dijalankan dengan `DATABASE_URL`, server otomatis:
1. Menerapkan seluruh file skema SQL di `server/migrations/*.sql` (dilacak pada tabel `schema_migrations` dengan PostgreSQL *advisory lock*).
2. Jika menemukan file SQLite lama (`server/data/jakludo.db`) atau JSON lama, seluruh data (`users`, `user_items`, `sessions`, `leaderboard`, `rooms`) otomatis dipindahkan ke PostgreSQL dalam satu transaksi idempoten, lalu file lama diubah namanya menjadi `jakludo.db.migrated-<timestamp>`.

Kamu juga bisa menjalankan migrasi atau mengecek status secara manual:
```bash
npm run db:migrate                              # jalankan skema + impor server/data/jakludo.db
node server/migrate.js --from-sqlite path.db    # impor eksplisit dari file SQLite tertentu
npm run db:status                               # cek versi migrasi & jumlah baris di PostgreSQL
npm run backup                                  # backup PostgreSQL (pg_dump / JSON)
```

## Arsitektur singkat

```
server/
  index.js            bootstrap: Express, Socket.IO, inisialisasi PostgreSQL, restore room, shutdown
  db.js               PostgreSQL (pg.Pool) + write-through state: user, sesi, leaderboard, stok item, room
  migrate.js          migrasi skema SQL berversi & migrasi data dari SQLite (jakludo.db) ke PostgreSQL
  migrations/         file skema SQL berurutan (001_initial_schema.sql, dst.)
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
