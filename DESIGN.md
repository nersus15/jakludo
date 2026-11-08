# JakLudo: arah desain

Dokumen ini merangkum identitas visual yang sudah dipakai JakLudo (logo, warna, huruf) supaya setiap perubahan UI punya acuan yang sama. Diturunkan dari aset yang sudah ada, bukan desain baru.

## Membaca produk

Reading this as: **game papan multiplayer santai** untuk **teman-teman yang main bareng lewat HP**, dengan bahasa visual **papan Ludo fisik yang hangat khas Jakarta**, dial **ENERGY 2 / RHYTHM 2 / MOTION 2**.

- **ENERGY 2**: ramah dan berwarna (empat warna Ludo), tapi papan permainan tetap pusat perhatian. Antarmuka di sekitarnya tenang.
- **RHYTHM 2**: layar konsisten (kartu putih di atas latar kertas hangat), dengan satu titik fokus per layar: hero di beranda, kode room di lobby, papan saat bermain.
- **MOTION 2**: gerakan hanya untuk umpan balik permainan (dadu berguling, bidak melangkah, giliran berpindah). Tidak ada animasi dekoratif yang berulang terus.

## Identitas

| Elemen | Pilihan | Alasan |
|---|---|---|
| Logo | `client/src/assets/jakludo-logo.jpg` (dadu, bidak, Monas) | Aset resmi yang sudah ada; satu-satunya ilustrasi, tidak ditambah ilustrasi generik. |
| Motif | Empat warna Ludo (merah, hijau, kuning, biru) | Langsung dikenali sebagai Ludo; dipakai untuk pemain, papan, dan aksen kecil. |
| Aksen | Oranye JakLudo `#ff6200` | Warna wordmark di logo. Dipakai hemat: tombol utama dan penanda giliran. |
| Latar | Kertas hangat `#f7f4ef` | Terasa seperti meja permainan, bukan dashboard. Kartu putih berdiri di atasnya. |
| Huruf isi | DM Sans | Sudah dipakai, sangat terbaca di ukuran kecil HP. |
| Huruf angka & judul | Space Grotesk | Angka dadu, kode room, dan skor terasa seperti papan permainan. |
| Ikon | Emoji, satu arti per emoji | Bahasa sehari-hari pemain; tidak memakai set ikon generik. |

## Token

Semua warna, jarak, radius, dan bayangan berasal dari `client/src/styles/tokens.css`. Tidak ada nilai hex lepas di stylesheet komponen kecuali warna papan Ludo.

- **Teks** (rasio di atas permukaan putih / latar): utama 17,2:1, sekunder 7,8:1, redup 5,8:1. Tidak ada teks di bawah 4,5:1.
- **Tombol utama**: latar `#ff6200` dengan teks `#1f1a17` (5,7:1). Teks putih di atas oranye hanya 3,0:1, jadi tidak dipakai.
- **Bayangan**: dua tingkat saja, `--shadow-1` untuk kartu dan `--shadow-2` untuk dialog/popover. Papan permainan punya bayangan sendiri karena ia fokus utama.
- **Radius**: 8px (kontrol), 14px (kartu), 20px (dialog), lingkaran hanya untuk bidak dan avatar.
- **Mode gelap**: mengikuti preferensi sistem; token yang sama dengan nilai gelap.

## Tata letak

- Breakpoint tetap: **640px** (HP besar), **768px** (tablet), **1100px** (desktop). Ditulis mobile-first dengan `min-width`.
- Area sentuh minimal 44×44px, termasuk bidak (area sentuh diperluas tanpa memperbesar gambar bidak).
- Saat bermain, papan dan HUD pemain harus muat dalam satu layar di desktop; di HP kontrol giliran ada tepat di bawah papan.

## Tidak dipakai

Efek kaca (backdrop blur), glow di banyak elemen, label kapital berjarak lebar, font monospace dekoratif, panah ↗ di tombol internal, dekorasi orbit/latar pola, klaim tanpa bukti.
