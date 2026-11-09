# JakLudo: arah desain

Dokumen ini merangkum identitas visual yang sudah dipakai JakLudo (logo, warna, huruf) supaya setiap perubahan UI punya acuan yang sama. Diturunkan dari aset yang sudah ada (logo dan empat warna Ludo).

## Membaca produk

Reading this as: **game papan multiplayer santai** untuk **teman-teman yang main bareng lewat HP**, dengan bahasa visual **papan Ludo fisik yang hangat khas Jakarta**, dial **ENERGY 3 / RHYTHM 2 / MOTION 2**.

- **ENERGY 3**: terasa seperti papan cetak di atas meja: krem hangat, tepi tinta tegas, bayangan keras, empat warna Ludo yang berani. Papan permainan tetap pusat perhatian.
- **RHYTHM 2**: layar konsisten (kartu krem bertepi di atas latar meja), dengan satu titik fokus per layar: hero di beranda, kode room di lobby, papan saat bermain.
- **MOTION 2**: gerakan hanya untuk umpan balik permainan (dadu berguling, bidak melangkah, giliran berpindah). Tidak ada animasi dekoratif yang berulang terus.

## Identitas

| Elemen | Pilihan | Alasan |
|---|---|---|
| Logo | `client/src/assets/jakludo-logo.jpg` (dadu, bidak, Monas) | Aset resmi yang sudah ada; satu-satunya ilustrasi, tidak ditambah ilustrasi generik. |
| Motif | Empat warna Ludo (merah, hijau, kuning, biru) | Langsung dikenali sebagai Ludo; dipakai untuk pemain, papan, dan aksen kecil. |
| Aksen | Oranye JakLudo `#ff6200` | Warna wordmark di logo. Dipakai hemat: tombol utama dan penanda giliran. |
| Latar | Krem meja `#f5ecdc`, kartu `#fffaf1` | Terasa seperti karton papan permainan, bukan dashboard. |
| Garis & bayangan | Tinta `#2b2420`, bayangan keras `0 3px 0` / `0 5px 0` | Motif "papan cetak": tepi jelas, tombol benar-benar turun saat ditekan. |
| Huruf judul & angka | Fredoka | Membulat seperti huruf di logo, ramah untuk game. Space Grotesk ditinggalkan karena termasuk font bawaan desain AI. |
| Huruf isi | Nunito | Membulat serasi dengan Fredoka dan tetap terbaca di ukuran kecil. Menggantikan DM Sans dengan alasan yang sama. |
| Ikon | Emoji, satu arti per emoji | Bahasa sehari-hari pemain; tidak memakai set ikon generik. |

## Token

Semua warna, jarak, radius, dan bayangan berasal dari `client/src/styles/tokens.css`. Tidak ada nilai hex lepas di stylesheet komponen kecuali warna papan Ludo.

- **Teks** (rasio di atas permukaan putih / latar): utama 14,7:1, sekunder 7,6:1, redup 5,8:1. Tidak ada teks di bawah 4,5:1.
- **Tombol utama**: latar `#ff6200` dengan teks tinta `#2b2420` (5,1:1) dan tepi tinta. Teks putih di atas oranye hanya 3,0:1, jadi tidak dipakai.
- **Bayangan**: bayangan keras tanpa blur, `--lift-1` untuk tombol dan `--lift-2` untuk kartu fokus/dialog. `--shadow-pop` hanya untuk popover. Papan punya `--shadow-board` sendiri.
- **Kartu fokus**: tiap layar hanya punya satu `.card--focus` (kartu main di beranda, kode room di lobby, panel giliran saat giliranmu). Kartu lain datar dengan tepi tipis.
- **Radius**: 10px (kontrol), 16px (kartu), 22px (dialog), lingkaran hanya untuk bidak dan avatar.
- **Tema**: terang secara default. Tombol tema di header berputar Terang → Gelap → Ikut perangkat, pilihan disimpan di `localStorage` (`jakludo_theme`) dan dipasang lewat `data-theme` di `<html>` sebelum React jalan supaya tidak berkedip. Tema gelap = meja malam: cokelat tua, tinta krem, oranye tetap.

## Tata letak

- Breakpoint tetap: **640px** (HP besar), **768px** (tablet), **1100px** (desktop). Ditulis mobile-first dengan `min-width`.
- Area sentuh minimal 44×44px, termasuk bidak (area sentuh diperluas tanpa memperbesar gambar bidak).
- Saat bermain, papan dan HUD pemain harus muat dalam satu layar di desktop; di HP kontrol giliran ada tepat di bawah papan.

## Tidak dipakai

Efek kaca (backdrop blur), bayangan blur lembut ala dashboard, glow di banyak elemen, label kapital berjarak lebar, font monospace dekoratif, panah ↗ di tombol internal, dekorasi orbit/latar pola, klaim tanpa bukti.
