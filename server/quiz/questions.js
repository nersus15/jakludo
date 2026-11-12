// Bank soal Monster Quiz Battle (183 soal tervalidasi: 123 Pengetahuan Umum + 60 Hitung-hitungan Cepat)
// serta modul manajemen bank soal (siap dihubungkan ke Admin Panel di masa depan).
// Jawaban benar (correctIndex) HANYA disimpan di backend dan tidak pernah dikirim ke klien sebelum ronde selesai.
const crypto = require('crypto');

const SEED_QUESTIONS = [
  // =========================================================================
  // A. PENGETAHUAN UMUM (32 soal)
  // Topik: Geografi, Sains Dasar, Sejarah Umum, Teknologi, Budaya, Hewan & Alam
  // =========================================================================

  // Geografi (6)
  {
    id: 'q_gen_001',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'easy',
    prompt: 'Apa ibu kota provinsi Jawa Timur?',
    options: ['Surabaya', 'Semarang', 'Bandung', 'Malang'],
    correctIndex: 0
  },
  {
    id: 'q_gen_002',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'easy',
    prompt: 'Benua terluas di permukaan Bumi adalah...',
    options: ['Afrika', 'Asia', 'Amerika', 'Eropa'],
    correctIndex: 1
  },
  {
    id: 'q_gen_003',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'medium',
    prompt: 'Selat yang memisahkan Pulau Sumatra dan Pulau Jawa adalah...',
    options: ['Selat Bali', 'Selat Malaka', 'Selat Sunda', 'Selat Makassar'],
    correctIndex: 2
  },
  {
    id: 'q_gen_004',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'medium',
    prompt: 'Danau vulkanik terbesar di Indonesia yang terletak di Sumatra Utara adalah...',
    options: ['Danau Singkarak', 'Danau Toba', 'Danau Sentani', 'Danau Maninjau'],
    correctIndex: 1
  },
  {
    id: 'q_gen_005',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'easy',
    prompt: 'Negara yang dijuluki Negeri Matahari Terbit adalah...',
    options: ['Korea Selatan', 'Tiongkok', 'Thailand', 'Jepang'],
    correctIndex: 3
  },
  {
    id: 'q_gen_006',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'medium',
    prompt: 'Sungai terpanjang di Indonesia yang berada di Pulau Kalimantan adalah...',
    options: ['Sungai Musi', 'Sungai Mahakam', 'Sungai Kapuas', 'Sungai Bengawan Solo'],
    correctIndex: 2
  },

  // Sains Dasar (6)
  {
    id: 'q_gen_007',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'easy',
    prompt: 'Gas yang paling dibutuhkan manusia saat menarik napas adalah...',
    options: ['Karbon dioksida', 'Oksigen', 'Helium', 'Hidrogen'],
    correctIndex: 1
  },
  {
    id: 'q_gen_008',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'easy',
    prompt: 'Planet terdekat dengan Matahari dalam tata surya kita adalah...',
    options: ['Merkurius', 'Venus', 'Mars', 'Bumi'],
    correctIndex: 0
  },
  {
    id: 'q_gen_009',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'easy',
    prompt: 'Pada tekanan udara normal, air murni mendidih pada suhu...',
    options: ['50 °C', '80 °C', '100 °C', '120 °C'],
    correctIndex: 2
  },
  {
    id: 'q_gen_010',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'medium',
    prompt: 'Proses tumbuhan hijau membuat makanan dengan bantuan cahaya matahari disebut...',
    options: ['Respirasi', 'Evaporasi', 'Fermentasi', 'Fotosintesis'],
    correctIndex: 3
  },
  {
    id: 'q_gen_011',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'medium',
    prompt: 'Alat yang digunakan untuk mengukur suhu suatu benda adalah...',
    options: ['Barometer', 'Termometer', 'Speedometer', 'Higrometer'],
    correctIndex: 1
  },
  {
    id: 'q_gen_012',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'medium',
    prompt: 'Rumus kimia untuk senyawa air adalah...',
    options: ['CO2', 'H2O', 'NaCl', 'O2'],
    correctIndex: 1
  },

  // Sejarah Umum (5)
  {
    id: 'q_gen_013',
    category: 'general',
    topic: 'Sejarah Umum',
    difficulty: 'easy',
    prompt: 'Proklamasi Kemerdekaan Republik Indonesia dibacakan pada tanggal...',
    options: ['17 Agustus 1945', '28 Oktober 1928', '1 Juni 1945', '10 November 1945'],
    correctIndex: 0
  },
  {
    id: 'q_gen_014',
    category: 'general',
    topic: 'Sejarah Umum',
    difficulty: 'easy',
    prompt: 'Siapakah pencipta lagu kebangsaan Indonesia Raya?',
    options: ['Ismail Marzuki', 'Ibu Sud', 'W.R. Supratman', 'Kusbini'],
    correctIndex: 2
  },
  {
    id: 'q_gen_015',
    category: 'general',
    topic: 'Sejarah Umum',
    difficulty: 'medium',
    prompt: 'Candi Buddha terbesar di dunia yang berada di Magelang, Jawa Tengah adalah...',
    options: ['Candi Prambanan', 'Candi Borobudur', 'Candi Mendut', 'Candi Kalasan'],
    correctIndex: 1
  },
  {
    id: 'q_gen_016',
    category: 'general',
    topic: 'Sejarah Umum',
    difficulty: 'medium',
    prompt: 'Hari Pahlawan di Indonesia diperingati setiap tanggal 10 November untuk mengenang pertempuran di kota...',
    options: ['Bandung', 'Yogyakarta', 'Surabaya', 'Medan'],
    correctIndex: 2
  },
  {
    id: 'q_gen_017',
    category: 'general',
    topic: 'Sejarah Umum',
    difficulty: 'medium',
    prompt: 'Naskah Sumpah Pemuda diikrarkan pada Kongres Pemuda II tanggal 28 Oktober tahun...',
    options: ['1908', '1928', '1942', '1945'],
    correctIndex: 1
  },

  // Teknologi (5)
  {
    id: 'q_gen_018',
    category: 'general',
    topic: 'Teknologi',
    difficulty: 'easy',
    prompt: 'Komponen komputer yang sering disebut sebagai "otak" pemrosesan utama adalah...',
    options: ['CPU', 'Monitor', 'Speaker', 'Mouse'],
    correctIndex: 0
  },
  {
    id: 'q_gen_019',
    category: 'general',
    topic: 'Teknologi',
    difficulty: 'easy',
    prompt: 'Satuan terkecil dalam penyimpanan informasi digital yang bernilai 0 atau 1 adalah...',
    options: ['Megabyte', 'Bit', 'Gigahertz', 'Pixel'],
    correctIndex: 1
  },
  {
    id: 'q_gen_020',
    category: 'general',
    topic: 'Teknologi',
    difficulty: 'medium',
    prompt: 'Bahasa markup standar yang digunakan untuk menyusun struktur halaman web adalah...',
    options: ['HTML', 'JPEG', 'MP3', 'BIOS'],
    correctIndex: 0
  },
  {
    id: 'q_gen_021',
    category: 'general',
    topic: 'Teknologi',
    difficulty: 'medium',
    prompt: 'Dalam istilah jaringan internet, kepanjangan dari huruf "U" pada singkatan URL adalah...',
    options: ['Universal', 'Uniform', 'Unlimited', 'Utility'],
    correctIndex: 1
  },
  {
    id: 'q_gen_022',
    category: 'general',
    topic: 'Teknologi',
    difficulty: 'easy',
    prompt: 'Kombinasi tombol pintas keyboard umum untuk menyalin (copy) teks adalah...',
    options: ['Ctrl + V', 'Ctrl + X', 'Ctrl + C', 'Ctrl + Z'],
    correctIndex: 2
  },

  // Budaya & Pengetahuan Sehari-hari (5)
  {
    id: 'q_gen_023',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'easy',
    prompt: 'Alat musik tradisional Angklung yang terbuat dari bambu berasal dari daerah...',
    options: ['Jawa Barat', 'Bali', 'Sumatra Barat', 'Sulawesi Selatan'],
    correctIndex: 0
  },
  {
    id: 'q_gen_024',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'easy',
    prompt: 'Semboyan negara Indonesia yang tertulis pada pita burung Garuda Pancasila adalah...',
    options: ['Tut Wuri Handayani', 'Bhinneka Tunggal Ika', 'Jalesveva Jayamahe', 'Kartika Eka Paksi'],
    correctIndex: 1
  },
  {
    id: 'q_gen_025',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'easy',
    prompt: 'Berapa jumlah pemain dalam satu tim sepak bola yang berada di lapangan saat pertandingan dimulai?',
    options: ['9 orang', '10 orang', '11 orang', '12 orang'],
    correctIndex: 2
  },
  {
    id: 'q_gen_026',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'medium',
    prompt: 'Rumah adat Gadang yang memiliki atap meruncing seperti tanduk kerbau berasal dari provinsi...',
    options: ['Sumatra Barat', 'Riau', 'Aceh', 'Jambi'],
    correctIndex: 0
  },
  {
    id: 'q_gen_027',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'medium',
    prompt: 'Olahraga bulu tangkis memperebutkan piala beregu putra bergengsi dunia yang bernama...',
    options: ['Piala Uber', 'Piala Thomas', 'Piala Davis', 'Piala Dunia'],
    correctIndex: 1
  },

  // Dunia Hewan & Alam (5)
  {
    id: 'q_gen_028',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'easy',
    prompt: 'Mamalia laut terbesar yang pernah hidup di Bumi adalah...',
    options: ['Hiu Putih', 'Paus Biru', 'Lumba-lumba', 'Gajah Laut'],
    correctIndex: 1
  },
  {
    id: 'q_gen_029',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'easy',
    prompt: 'Kadal purba raksasa asli Indonesia yang hidup di Nusa Tenggara Timur adalah...',
    options: ['Iguana', 'Biawak Air', 'Komodo', 'Bunglon'],
    correctIndex: 2
  },
  {
    id: 'q_gen_030',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'easy',
    prompt: 'Hewan darat tercepat di dunia yang mampu berlari sangat kencang saat berburu adalah...',
    options: ['Singa', 'Kuda', 'Cheetah', 'Serigala'],
    correctIndex: 2
  },
  {
    id: 'q_gen_031',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'medium',
    prompt: 'Kelompok hewan pemakan tumbuhan seperti sapi, kambing, dan kelinci disebut...',
    options: ['Karnivora', 'Herbivora', 'Omnivora', 'Insektivora'],
    correctIndex: 1
  },
  {
    id: 'q_gen_032',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'medium',
    prompt: 'Burung khas Papua yang terkenal karena keindahan bulunya dan dijuluki Burung Surga adalah...',
    options: ['Burung Merak', 'Burung Cenderawasih', 'Burung Jalak Bali', 'Burung Kasuari'],
    correctIndex: 1
  },

  // Soal Pengayaan Tambahan Pengetahuan Umum (30 soal baru: q_gen_033 - q_gen_062)
  {
    id: 'q_gen_033',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'easy',
    prompt: 'Ibu kota baru Republik Indonesia yang terletak di Kalimantan Timur bernama...',
    options: ['Nusantara', 'Tarakan', 'Balikpapan', 'Samarinda'],
    correctIndex: 0
  },
  {
    id: 'q_gen_034',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'medium',
    prompt: 'Gunung tertinggi di Indonesia yang puncaknya diselimuti salju abadi adalah...',
    options: ['Puncak Jaya', 'Gunung Kerinci', 'Gunung Rinjani', 'Gunung Semeru'],
    correctIndex: 0
  },
  {
    id: 'q_gen_035',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'easy',
    prompt: 'Negara kepulauan terbesar di dunia berdasarkan jumlah pulau adalah...',
    options: ['Filipina', 'Indonesia', 'Madagaskar', 'Jepang'],
    correctIndex: 1
  },
  {
    id: 'q_gen_036',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'easy',
    prompt: 'Samudra terluas dan terdalam di permukaan Bumi adalah...',
    options: ['Samudra Atlantik', 'Samudra Hindia', 'Samudra Pasifik', 'Samudra Arktik'],
    correctIndex: 2
  },
  {
    id: 'q_gen_037',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'easy',
    prompt: 'Menara Eiffel yang terkenal di dunia berada di kota...',
    options: ['London', 'Roma', 'Paris', 'Berlin'],
    correctIndex: 2
  },
  {
    id: 'q_gen_038',
    category: 'general',
    topic: 'Luar Angkasa',
    difficulty: 'easy',
    prompt: 'Planet terbesar dalam Tata Surya kita adalah...',
    options: ['Saturnus', 'Jupiter', 'Neptunus', 'Uranus'],
    correctIndex: 1
  },
  {
    id: 'q_gen_039',
    category: 'general',
    topic: 'Luar Angkasa',
    difficulty: 'easy',
    prompt: 'Satelit alami yang senantiasa mengitari planet Bumi adalah...',
    options: ['Bulan', 'Matahari', 'Titan', 'Phobos'],
    correctIndex: 0
  },
  {
    id: 'q_gen_040',
    category: 'general',
    topic: 'Luar Angkasa',
    difficulty: 'easy',
    prompt: 'Planet di Tata Surya yang sering dijuluki sebagai "Planet Merah" adalah...',
    options: ['Venus', 'Merkurius', 'Mars', 'Jupiter'],
    correctIndex: 2
  },
  {
    id: 'q_gen_041',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'easy',
    prompt: 'Zat hijau pada daun tumbuhan yang berperan menyerap energi cahaya matahari adalah...',
    options: ['Karoten', 'Klorofil', 'Glukosa', 'Kambium'],
    correctIndex: 1
  },
  {
    id: 'q_gen_042',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'medium',
    prompt: 'Benda langit yang terbakar saat memasuki atmosfer Bumi dan tampak menyala terang di langit malam disebut...',
    options: ['Komet', 'Meteor', 'Asteroid', 'Supernova'],
    correctIndex: 1
  },
  {
    id: 'q_gen_043',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'easy',
    prompt: 'Perubahan wujud benda dari zat cair menjadi zat gas disebut...',
    options: ['Membeku', 'Menguap', 'Menyublim', 'Mengembun'],
    correctIndex: 1
  },
  {
    id: 'q_gen_044',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'easy',
    prompt: 'Gaya tarik Bumi yang menyebabkan semua benda jatuh ke bawah disebut...',
    options: ['Gaya Gesek', 'Gaya Gravitasi', 'Gaya Magnet', 'Gaya Pegas'],
    correctIndex: 1
  },
  {
    id: 'q_gen_045',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'medium',
    prompt: 'Organ tubuh manusia yang berfungsi utama memompa darah ke seluruh tubuh adalah...',
    options: ['Paru-paru', 'Ginjal', 'Hati', 'Jantung'],
    correctIndex: 3
  },
  {
    id: 'q_gen_046',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'easy',
    prompt: 'Hewan mamalia yang terkenal dapat terbang aktif dengan sayap selaput adalah...',
    options: ['Kelelawar', 'Tupai Terbang', 'Burung Hantu', 'Kasuari'],
    correctIndex: 0
  },
  {
    id: 'q_gen_047',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'easy',
    prompt: 'Hewan reptil yang terkenal dapat berkamuflase mengubah warna kulitnya sesuai lingkungan adalah...',
    options: ['Bunglon', 'Katak Pohon', 'Iguana', 'Trenggiling'],
    correctIndex: 0
  },
  {
    id: 'q_gen_048',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'easy',
    prompt: 'Proses perubahan bentuk tubuh hewan dari telur, ulat, kepompong, hingga menjadi kupu-kupu disebut...',
    options: ['Metamorfosis', 'Evolusi', 'Hibernasi', 'Regenerasi'],
    correctIndex: 0
  },
  {
    id: 'q_gen_049',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'easy',
    prompt: 'Mamalia khas benua Australia yang membesarkan anaknya di dalam kantung perut adalah...',
    options: ['Koala', 'Kanguru', 'Platipus', 'Wombat'],
    correctIndex: 1
  },
  {
    id: 'q_gen_050',
    category: 'general',
    topic: 'Sejarah Umum',
    difficulty: 'easy',
    prompt: 'Presiden pertama Republik Indonesia yang membacakan naskah Proklamasi Kemerdekaan adalah...',
    options: ['Soeharto', 'Ir. Soekarno', 'B.J. Habibie', 'Abdurrahman Wahid'],
    correctIndex: 1
  },
  {
    id: 'q_gen_051',
    category: 'general',
    topic: 'Sejarah Umum',
    difficulty: 'easy',
    prompt: 'Pahlawan nasional wanita dari Jepara yang gigih memperjuangkan emansipasi pendidikan wanita adalah...',
    options: ['Cut Nyak Dien', 'R.A. Kartini', 'Dewi Sartika', 'Martha Christina Tiahahu'],
    correctIndex: 1
  },
  {
    id: 'q_gen_052',
    category: 'general',
    topic: 'Sejarah Umum',
    difficulty: 'medium',
    prompt: 'Kerajaan maritim Hindu-Buddha terbesar di Nusantara yang berpusat di Jawa Timur adalah...',
    options: ['Kerajaan Sriwijaya', 'Kerajaan Majapahit', 'Kerajaan Tarumanegara', 'Kerajaan Mataram Kuno'],
    correctIndex: 1
  },
  {
    id: 'q_gen_053',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'easy',
    prompt: 'Rendang, masakan daging berbumbu yang terkenal hingga ke mancanegara, berasal dari...',
    options: ['Padang, Sumatra Barat', 'Yogyakarta', 'Manado, Sulawesi Utara', 'Palembang, Sumatra Selatan'],
    correctIndex: 0
  },
  {
    id: 'q_gen_054',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'easy',
    prompt: 'Kain tradisional bermotif indah warisan budaya dunia asli Indonesia yang diakui UNESCO adalah...',
    options: ['Kain Songket', 'Kain Ulos', 'Kain Batik', 'Kain Tenun Ikat'],
    correctIndex: 2
  },
  {
    id: 'q_gen_055',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'easy',
    prompt: 'Tari Kecak yang menampilkan puluhan penari pria duduk melingkar melantunkan irama vokal berasal dari provinsi...',
    options: ['Bali', 'Lombok', 'Jawa Tengah', 'Sumatra Utara'],
    correctIndex: 0
  },
  {
    id: 'q_gen_056',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'easy',
    prompt: 'Makanan khas Yogyakarta bercita rasa manis legit yang dimasak dari nangka muda adalah...',
    options: ['Gudeg', 'Rawon', 'Pempek', 'Papeda'],
    correctIndex: 0
  },
  {
    id: 'q_gen_057',
    category: 'general',
    topic: 'Teknologi',
    difficulty: 'easy',
    prompt: 'Aplikasi penjelajah web (browser) populer yang dikembangkan oleh perusahaan Google adalah...',
    options: ['Safari', 'Google Chrome', 'Mozilla Firefox', 'Opera Mini'],
    correctIndex: 1
  },
  {
    id: 'q_gen_058',
    category: 'general',
    topic: 'Teknologi',
    difficulty: 'easy',
    prompt: 'Perangkat keras komputer yang berfungsi untuk menampilkan antarmuka visual kepada pengguna adalah...',
    options: ['Monitor', 'Keyboard', 'Hard Disk', 'Motherboard'],
    correctIndex: 0
  },
  {
    id: 'q_gen_059',
    category: 'general',
    topic: 'Teknologi',
    difficulty: 'easy',
    prompt: 'Kepanjangan dari teknologi koneksi nirkabel jarak pendek Wi-Fi adalah singkatan dari...',
    options: ['Wireless Fidelity', 'Wireless File', 'Wide Filter', 'Web Fiber'],
    correctIndex: 0
  },
  {
    id: 'q_gen_060',
    category: 'general',
    topic: 'Pengetahuan Umum',
    difficulty: 'easy',
    prompt: 'Warna primer dalam seni rupa pigmen yang tidak dapat dihasilkan dari campuran warna lain adalah...',
    options: ['Merah, Kuning, Biru', 'Merah, Hijau, Hitam', 'Biru, Oranye, Ungu', 'Kuning, Hijau, Putih'],
    correctIndex: 0
  },
  {
    id: 'q_gen_061',
    category: 'general',
    topic: 'Pengetahuan Umum',
    difficulty: 'easy',
    prompt: 'Berapakah jumlah hari dalam satu tahun kabisat yang terjadi setiap empat tahun sekali?',
    options: ['364 hari', '365 hari', '366 hari', '367 hari'],
    correctIndex: 2
  },
  {
    id: 'q_gen_062',
    category: 'general',
    topic: 'Pengetahuan Umum',
    difficulty: 'easy',
    prompt: 'Berapa banyak warna utama yang tampak pada spektrum pelangi standar?',
    options: ['5 warna', '6 warna', '7 warna', '8 warna'],
    correctIndex: 2
  },

  // =========================================================================
  // B. HITUNG-HITUNGAN CEPAT (32 soal)
  // Topik: Penjumlahan, Pengurangan, Perkalian, Pembagian, Operasi Campuran
  // =========================================================================

  // Penjumlahan (7)
  {
    id: 'q_math_001',
    category: 'math',
    topic: 'Penjumlahan',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 37 + 48?',
    options: ['75', '85', '86', '95'],
    correctIndex: 1
  },
  {
    id: 'q_math_002',
    category: 'math',
    topic: 'Penjumlahan',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 64 + 29?',
    options: ['83', '92', '93', '94'],
    correctIndex: 2
  },
  {
    id: 'q_math_003',
    category: 'math',
    topic: 'Penjumlahan',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 125 + 75?',
    options: ['190', '195', '200', '205'],
    correctIndex: 2
  },
  {
    id: 'q_math_004',
    category: 'math',
    topic: 'Penjumlahan',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 168 + 57?',
    options: ['215', '225', '235', '227'],
    correctIndex: 1
  },
  {
    id: 'q_math_005',
    category: 'math',
    topic: 'Penjumlahan',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 46 + 54?',
    options: ['90', '98', '100', '104'],
    correctIndex: 2
  },
  {
    id: 'q_math_006',
    category: 'math',
    topic: 'Penjumlahan',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 235 + 149?',
    options: ['374', '384', '394', '386'],
    correctIndex: 1
  },
  {
    id: 'q_math_007',
    category: 'math',
    topic: 'Penjumlahan',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 58 + 67?',
    options: ['115', '123', '125', '135'],
    correctIndex: 2
  },

  // Pengurangan (6)
  {
    id: 'q_math_008',
    category: 'math',
    topic: 'Pengurangan',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 92 − 38?',
    options: ['54', '56', '64', '44'],
    correctIndex: 0
  },
  {
    id: 'q_math_009',
    category: 'math',
    topic: 'Pengurangan',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 150 − 65?',
    options: ['75', '85', '95', '80'],
    correctIndex: 1
  },
  {
    id: 'q_math_010',
    category: 'math',
    topic: 'Pengurangan',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 100 − 43?',
    options: ['53', '57', '67', '47'],
    correctIndex: 1
  },
  {
    id: 'q_math_011',
    category: 'math',
    topic: 'Pengurangan',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 210 − 76?',
    options: ['124', '134', '144', '136'],
    correctIndex: 1
  },
  {
    id: 'q_math_012',
    category: 'math',
    topic: 'Pengurangan',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 300 − 128?',
    options: ['162', '172', '182', '178'],
    correctIndex: 1
  },
  {
    id: 'q_math_013',
    category: 'math',
    topic: 'Pengurangan',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 84 − 29?',
    options: ['45', '53', '55', '65'],
    correctIndex: 2
  },

  // Perkalian Sederhana (7)
  {
    id: 'q_math_014',
    category: 'math',
    topic: 'Perkalian',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 7 × 8?',
    options: ['54', '56', '58', '64'],
    correctIndex: 1
  },
  {
    id: 'q_math_015',
    category: 'math',
    topic: 'Perkalian',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 9 × 6?',
    options: ['48', '52', '54', '63'],
    correctIndex: 2
  },
  {
    id: 'q_math_016',
    category: 'math',
    topic: 'Perkalian',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 12 × 7?',
    options: ['74', '82', '84', '96'],
    correctIndex: 2
  },
  {
    id: 'q_math_017',
    category: 'math',
    topic: 'Perkalian',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 15 × 6?',
    options: ['80', '85', '90', '95'],
    correctIndex: 2
  },
  {
    id: 'q_math_018',
    category: 'math',
    topic: 'Perkalian',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 14 × 5?',
    options: ['60', '65', '70', '75'],
    correctIndex: 2
  },
  {
    id: 'q_math_019',
    category: 'math',
    topic: 'Perkalian',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 11 × 11?',
    options: ['111', '121', '131', '122'],
    correctIndex: 1
  },
  {
    id: 'q_math_020',
    category: 'math',
    topic: 'Perkalian',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 16 × 4?',
    options: ['56', '60', '64', '68'],
    correctIndex: 2
  },

  // Pembagian Sederhana (6)
  {
    id: 'q_math_021',
    category: 'math',
    topic: 'Pembagian',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 72 ÷ 8?',
    options: ['7', '8', '9', '10'],
    correctIndex: 2
  },
  {
    id: 'q_math_022',
    category: 'math',
    topic: 'Pembagian',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 81 ÷ 9?',
    options: ['8', '9', '7', '11'],
    correctIndex: 1
  },
  {
    id: 'q_math_023',
    category: 'math',
    topic: 'Pembagian',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 96 ÷ 8?',
    options: ['11', '12', '13', '14'],
    correctIndex: 1
  },
  {
    id: 'q_math_024',
    category: 'math',
    topic: 'Pembagian',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 108 ÷ 9?',
    options: ['11', '12', '13', '14'],
    correctIndex: 1
  },
  {
    id: 'q_math_025',
    category: 'math',
    topic: 'Pembagian',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 120 ÷ 15?',
    options: ['6', '7', '8', '9'],
    correctIndex: 2
  },
  {
    id: 'q_math_026',
    category: 'math',
    topic: 'Pembagian',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 144 ÷ 12?',
    options: ['10', '11', '12', '14'],
    correctIndex: 2
  },

  // Operasi Campuran Sederhana (6)
  {
    id: 'q_math_027',
    category: 'math',
    topic: 'Operasi Campuran',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari (6 × 5) + 14?',
    options: ['42', '44', '46', '34'],
    correctIndex: 1
  },
  {
    id: 'q_math_028',
    category: 'math',
    topic: 'Operasi Campuran',
    difficulty: 'easy',
    prompt: 'Berapakah hasil dari 50 − (7 × 4)?',
    options: ['18', '22', '24', '28'],
    correctIndex: 1
  },
  {
    id: 'q_math_029',
    category: 'math',
    topic: 'Operasi Campuran',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari (45 ÷ 5) + 18?',
    options: ['25', '27', '29', '23'],
    correctIndex: 1
  },
  {
    id: 'q_math_030',
    category: 'math',
    topic: 'Operasi Campuran',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari (8 × 6) − 15?',
    options: ['31', '33', '35', '37'],
    correctIndex: 1
  },
  {
    id: 'q_math_031',
    category: 'math',
    topic: 'Operasi Campuran',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari (12 + 8) × 3?',
    options: ['36', '54', '60', '64'],
    correctIndex: 2
  },
  {
    id: 'q_math_032',
    category: 'math',
    topic: 'Operasi Campuran',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari (64 ÷ 8) × 5?',
    options: ['35', '40', '45', '30'],
    correctIndex: 1
  },

  // =========================================================================
  // C. SOAL TANTANGAN (61 umum + 28 hitung-hitungan)
  // Lebih menantang: fakta unik sains, luar angkasa, sejarah, budaya, dan hitungan bertingkat
  // =========================================================================

  {
    id: 'q_gen_063',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'hard',
    prompt: 'Negara yang memiliki garis pantai terpanjang di dunia adalah...',
    options: ['Kanada', 'Indonesia', 'Rusia', 'Australia'],
    correctIndex: 0
  },
  {
    id: 'q_gen_064',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'hard',
    prompt: 'Danau terdalam di dunia yang terletak di Siberia, Rusia adalah...',
    options: ['Danau Baikal', 'Danau Tanganyika', 'Danau Toba', 'Laut Kaspia'],
    correctIndex: 0
  },
  {
    id: 'q_gen_065',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'medium',
    prompt: 'Sungai terpanjang di benua Asia adalah...',
    options: ['Sungai Yangtze', 'Sungai Mekong', 'Sungai Gangga', 'Sungai Huang He'],
    correctIndex: 0
  },
  {
    id: 'q_gen_066',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'medium',
    prompt: 'Negara terkecil di dunia berdasarkan luas wilayahnya adalah...',
    options: ['Vatikan', 'Monako', 'San Marino', 'Liechtenstein'],
    correctIndex: 0
  },
  {
    id: 'q_gen_067',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'medium',
    prompt: 'Ibu kota negara Australia adalah...',
    options: ['Canberra', 'Sydney', 'Melbourne', 'Perth'],
    correctIndex: 0
  },
  {
    id: 'q_gen_068',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'medium',
    prompt: 'Ibu kota negara Kanada adalah...',
    options: ['Ottawa', 'Toronto', 'Vancouver', 'Montreal'],
    correctIndex: 0
  },
  {
    id: 'q_gen_069',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'hard',
    prompt: 'Selat yang memisahkan Pulau Bali dan Pulau Lombok adalah...',
    options: ['Selat Lombok', 'Selat Bali', 'Selat Alas', 'Selat Makassar'],
    correctIndex: 0
  },
  {
    id: 'q_gen_070',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'hard',
    prompt: 'Garis khayal pemisah fauna Asia dan Australia yang melintas di antara Bali dan Lombok disebut Garis...',
    options: ['Wallace', 'Weber', 'Lydekker', 'Khatulistiwa'],
    correctIndex: 0
  },
  {
    id: 'q_gen_071',
    category: 'general',
    topic: 'Geografi',
    difficulty: 'medium',
    prompt: 'Kota di Indonesia yang dilalui garis khatulistiwa dan memiliki Tugu Khatulistiwa adalah...',
    options: ['Pontianak', 'Samarinda', 'Palu', 'Manado'],
    correctIndex: 0
  },
  {
    id: 'q_gen_072',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'medium',
    prompt: 'Unsur kimia dengan lambang \'Fe\' adalah...',
    options: ['Besi', 'Fluor', 'Fosfor', 'Timah'],
    correctIndex: 0
  },
  {
    id: 'q_gen_073',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'hard',
    prompt: 'Lambang unsur kimia untuk emas adalah...',
    options: ['Au', 'Ag', 'Em', 'Go'],
    correctIndex: 0
  },
  {
    id: 'q_gen_074',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'hard',
    prompt: 'Logam yang berwujud cair pada suhu ruang adalah...',
    options: ['Raksa', 'Timbal', 'Natrium', 'Aluminium'],
    correctIndex: 0
  },
  {
    id: 'q_gen_075',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'medium',
    prompt: 'Tulang terpanjang di tubuh manusia adalah tulang...',
    options: ['Paha', 'Lengan atas', 'Kering', 'Belakang'],
    correctIndex: 0
  },
  {
    id: 'q_gen_076',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'hard',
    prompt: 'Jumlah tulang pada tubuh manusia dewasa adalah...',
    options: ['206', '212', '198', '300'],
    correctIndex: 0
  },
  {
    id: 'q_gen_077',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'hard',
    prompt: 'Golongan darah yang dikenal sebagai donor universal adalah...',
    options: ['O negatif', 'AB positif', 'A positif', 'B negatif'],
    correctIndex: 0
  },
  {
    id: 'q_gen_078',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'hard',
    prompt: 'Kecepatan cahaya di ruang hampa kira-kira sebesar...',
    options: ['300.000 km per detik', '30.000 km per detik', '3.000 km per detik', '340 meter per detik'],
    correctIndex: 0
  },
  {
    id: 'q_gen_079',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'medium',
    prompt: 'Bagian sel yang dijuluki \'pembangkit energi\' sel adalah...',
    options: ['Mitokondria', 'Ribosom', 'Nukleus', 'Vakuola'],
    correctIndex: 0
  },
  {
    id: 'q_gen_080',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'medium',
    prompt: 'Satuan SI untuk gaya adalah...',
    options: ['Newton', 'Joule', 'Watt', 'Pascal'],
    correctIndex: 0
  },
  {
    id: 'q_gen_081',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'medium',
    prompt: 'Satuan SI untuk hambatan listrik adalah...',
    options: ['Ohm', 'Volt', 'Ampere', 'Coulomb'],
    correctIndex: 0
  },
  {
    id: 'q_gen_082',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'medium',
    prompt: 'Gas yang paling banyak terkandung di atmosfer Bumi adalah...',
    options: ['Nitrogen', 'Oksigen', 'Karbon dioksida', 'Argon'],
    correctIndex: 0
  },
  {
    id: 'q_gen_083',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'medium',
    prompt: 'Lapisan atmosfer tempat terjadinya hujan, awan, dan cuaca adalah...',
    options: ['Troposfer', 'Stratosfer', 'Mesosfer', 'Termosfer'],
    correctIndex: 0
  },
  {
    id: 'q_gen_084',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'hard',
    prompt: 'Inti dalam Bumi (inner core) diyakini para ilmuwan berwujud...',
    options: ['Padat', 'Cair', 'Gas', 'Plasma'],
    correctIndex: 0
  },
  {
    id: 'q_gen_085',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'medium',
    prompt: 'Vitamin yang dapat dibentuk kulit dengan bantuan sinar matahari pagi adalah...',
    options: ['Vitamin D', 'Vitamin A', 'Vitamin C', 'Vitamin K'],
    correctIndex: 0
  },
  {
    id: 'q_gen_086',
    category: 'general',
    topic: 'Sains Dasar',
    difficulty: 'medium',
    prompt: 'Ilmuwan yang terkenal dengan teori relativitas adalah...',
    options: ['Albert Einstein', 'Isaac Newton', 'Nikola Tesla', 'Galileo Galilei'],
    correctIndex: 0
  },
  {
    id: 'q_gen_087',
    category: 'general',
    topic: 'Luar Angkasa',
    difficulty: 'hard',
    prompt: 'Planet yang satu harinya (rotasi) lebih lama daripada satu tahunnya (revolusi) adalah...',
    options: ['Venus', 'Merkurius', 'Mars', 'Neptunus'],
    correctIndex: 0
  },
  {
    id: 'q_gen_088',
    category: 'general',
    topic: 'Luar Angkasa',
    difficulty: 'hard',
    prompt: 'Planet yang berotasi seperti \'menggelinding\' karena sumbunya miring hampir 98 derajat adalah...',
    options: ['Uranus', 'Saturnus', 'Jupiter', 'Neptunus'],
    correctIndex: 0
  },
  {
    id: 'q_gen_089',
    category: 'general',
    topic: 'Luar Angkasa',
    difficulty: 'hard',
    prompt: 'Bintang yang paling dekat dengan planet Bumi adalah...',
    options: ['Matahari', 'Proxima Centauri', 'Sirius', 'Polaris'],
    correctIndex: 0
  },
  {
    id: 'q_gen_090',
    category: 'general',
    topic: 'Luar Angkasa',
    difficulty: 'hard',
    prompt: 'Satuan \'tahun cahaya\' dalam astronomi dipakai untuk mengukur...',
    options: ['Jarak', 'Waktu', 'Kecepatan', 'Kecerahan'],
    correctIndex: 0
  },
  {
    id: 'q_gen_091',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'hard',
    prompt: 'Hewan laut yang memiliki tiga jantung dan darah berwarna biru adalah...',
    options: ['Gurita', 'Bintang laut', 'Ubur-ubur', 'Kepiting'],
    correctIndex: 0
  },
  {
    id: 'q_gen_092',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'hard',
    prompt: 'Mamalia asal Australia yang berkembang biak dengan bertelur adalah...',
    options: ['Platipus', 'Koala', 'Wombat', 'Kanguru'],
    correctIndex: 0
  },
  {
    id: 'q_gen_093',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'medium',
    prompt: 'Burung terbesar di dunia yang tidak bisa terbang adalah...',
    options: ['Burung unta', 'Kasuari', 'Emu', 'Penguin kaisar'],
    correctIndex: 0
  },
  {
    id: 'q_gen_094',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'hard',
    prompt: 'Satwa endemik Sulawesi yang taringnya tumbuh menembus moncong hingga melengkung ke atas adalah...',
    options: ['Babirusa', 'Anoa', 'Tarsius', 'Maleo'],
    correctIndex: 0
  },
  {
    id: 'q_gen_095',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'medium',
    prompt: 'Primata mungil endemik Sulawesi yang terkenal dengan matanya yang sangat besar adalah...',
    options: ['Tarsius', 'Orangutan', 'Kukang', 'Bekantan'],
    correctIndex: 0
  },
  {
    id: 'q_gen_096',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'medium',
    prompt: 'Bunga tunggal terbesar di dunia yang tumbuh di hutan Sumatra adalah...',
    options: ['Rafflesia arnoldii', 'Anggrek bulan', 'Teratai raksasa', 'Melati'],
    correctIndex: 0
  },
  {
    id: 'q_gen_097',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'hard',
    prompt: 'Selain manusia dan primata, hewan yang memiliki sidik jari sangat mirip manusia adalah...',
    options: ['Koala', 'Panda', 'Kanguru', 'Beruang madu'],
    correctIndex: 0
  },
  {
    id: 'q_gen_098',
    category: 'general',
    topic: 'Hewan & Alam',
    difficulty: 'medium',
    prompt: 'Tumbuhan pemakan serangga yang daunnya berbentuk kantong disebut...',
    options: ['Kantong semar', 'Putri malu', 'Kaktus', 'Venus flytrap'],
    correctIndex: 0
  },
  {
    id: 'q_gen_099',
    category: 'general',
    topic: 'Sejarah Umum',
    difficulty: 'medium',
    prompt: 'Konferensi Asia Afrika pertama diadakan di Bandung pada tahun...',
    options: ['1955', '1945', '1961', '1950'],
    correctIndex: 0
  },
  {
    id: 'q_gen_100',
    category: 'general',
    topic: 'Sejarah Umum',
    difficulty: 'medium',
    prompt: 'Pahlawan dari Maluku yang memimpin perlawanan terhadap Belanda pada tahun 1817 adalah...',
    options: ['Kapitan Pattimura', 'Sultan Hasanuddin', 'Pangeran Diponegoro', 'Tuanku Imam Bonjol'],
    correctIndex: 0
  },
  {
    id: 'q_gen_101',
    category: 'general',
    topic: 'Sejarah Umum',
    difficulty: 'medium',
    prompt: 'Tokoh pendiri perguruan Taman Siswa yang dijuluki Bapak Pendidikan Nasional adalah...',
    options: ['Ki Hajar Dewantara', 'K.H. Ahmad Dahlan', 'Dr. Soetomo', 'H.O.S. Tjokroaminoto'],
    correctIndex: 0
  },
  {
    id: 'q_gen_102',
    category: 'general',
    topic: 'Sejarah Umum',
    difficulty: 'hard',
    prompt: 'Perundingan tahun 1949 yang membuat Belanda mengakui kedaulatan Indonesia adalah...',
    options: ['Konferensi Meja Bundar', 'Perjanjian Linggarjati', 'Perjanjian Renville', 'Perjanjian Roem-Royen'],
    correctIndex: 0
  },
  {
    id: 'q_gen_103',
    category: 'general',
    topic: 'Sejarah Umum',
    difficulty: 'medium',
    prompt: 'Wakil Presiden pertama Republik Indonesia adalah...',
    options: ['Mohammad Hatta', 'Sutan Sjahrir', 'Adam Malik', 'Sri Sultan Hamengkubuwono IX'],
    correctIndex: 0
  },
  {
    id: 'q_gen_104',
    category: 'general',
    topic: 'Sejarah Umum',
    difficulty: 'hard',
    prompt: 'Kota kuno peninggalan suku Inca di puncak Pegunungan Andes, Peru, adalah...',
    options: ['Machu Picchu', 'Chichen Itza', 'Petra', 'Angkor Wat'],
    correctIndex: 0
  },
  {
    id: 'q_gen_105',
    category: 'general',
    topic: 'Teknologi',
    difficulty: 'medium',
    prompt: 'Bahasa pemrograman yang diciptakan oleh Guido van Rossum adalah...',
    options: ['Python', 'Java', 'C++', 'Ruby'],
    correctIndex: 0
  },
  {
    id: 'q_gen_106',
    category: 'general',
    topic: 'Teknologi',
    difficulty: 'hard',
    prompt: 'Kepanjangan dari HTTP adalah...',
    options: ['HyperText Transfer Protocol', 'High Transfer Text Protocol', 'HyperText Transmission Program', 'Host Transfer Text Protocol'],
    correctIndex: 0
  },
  {
    id: 'q_gen_107',
    category: 'general',
    topic: 'Teknologi',
    difficulty: 'hard',
    prompt: 'Dalam sistem biner yang umum dipakai komputer, 1 kilobyte sama dengan... byte',
    options: ['1024', '1000', '512', '2048'],
    correctIndex: 0
  },
  {
    id: 'q_gen_108',
    category: 'general',
    topic: 'Teknologi',
    difficulty: 'hard',
    prompt: 'Bilangan biner 1010 jika diubah ke bilangan desimal bernilai...',
    options: ['10', '12', '5', '1010'],
    correctIndex: 0
  },
  {
    id: 'q_gen_109',
    category: 'general',
    topic: 'Teknologi',
    difficulty: 'medium',
    prompt: 'Sistem bilangan berbasis 16 yang memakai angka 0–9 dan huruf A–F disebut...',
    options: ['Heksadesimal', 'Oktal', 'Biner', 'Desimal'],
    correctIndex: 0
  },
  {
    id: 'q_gen_110',
    category: 'general',
    topic: 'Teknologi',
    difficulty: 'medium',
    prompt: 'Pendiri Microsoft bersama Paul Allen adalah...',
    options: ['Bill Gates', 'Steve Jobs', 'Mark Zuckerberg', 'Larry Page'],
    correctIndex: 0
  },
  {
    id: 'q_gen_111',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'medium',
    prompt: 'Senjata tradisional khas Aceh yang bentuknya menyerupai huruf L adalah...',
    options: ['Rencong', 'Keris', 'Kujang', 'Mandau'],
    correctIndex: 0
  },
  {
    id: 'q_gen_112',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'hard',
    prompt: 'Alat musik petik Sasando yang terbuat dari daun lontar berasal dari...',
    options: ['Pulau Rote, NTT', 'Pulau Nias, Sumatra Utara', 'Pulau Lombok, NTB', 'Pulau Ambon, Maluku'],
    correctIndex: 0
  },
  {
    id: 'q_gen_113',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'medium',
    prompt: 'Tari Saman yang terkenal dengan gerakan tepuk tangan serempak berasal dari...',
    options: ['Aceh', 'Bali', 'Papua', 'Sulawesi Selatan'],
    correctIndex: 0
  },
  {
    id: 'q_gen_114',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'hard',
    prompt: 'Upacara pemakaman adat yang terkenal dari Tana Toraja disebut...',
    options: ['Rambu Solo', 'Ngaben', 'Kasada', 'Sekaten'],
    correctIndex: 0
  },
  {
    id: 'q_gen_115',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'medium',
    prompt: 'Penulis novel \'Laskar Pelangi\' adalah...',
    options: ['Andrea Hirata', 'Tere Liye', 'Pramoedya Ananta Toer', 'Habiburrahman El Shirazy'],
    correctIndex: 0
  },
  {
    id: 'q_gen_116',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'hard',
    prompt: 'Penulis novel \'Bumi Manusia\' adalah...',
    options: ['Pramoedya Ananta Toer', 'Chairil Anwar', 'Sapardi Djoko Damono', 'Ahmad Tohari'],
    correctIndex: 0
  },
  {
    id: 'q_gen_117',
    category: 'general',
    topic: 'Budaya & Sehari-hari',
    difficulty: 'medium',
    prompt: 'Lukisan terkenal \'Mona Lisa\' dibuat oleh...',
    options: ['Leonardo da Vinci', 'Vincent van Gogh', 'Pablo Picasso', 'Michelangelo'],
    correctIndex: 0
  },
  {
    id: 'q_gen_118',
    category: 'general',
    topic: 'Pengetahuan Umum',
    difficulty: 'medium',
    prompt: 'Negara tuan rumah Piala Dunia FIFA 2022 adalah...',
    options: ['Qatar', 'Rusia', 'Brasil', 'Arab Saudi'],
    correctIndex: 0
  },
  {
    id: 'q_gen_119',
    category: 'general',
    topic: 'Pengetahuan Umum',
    difficulty: 'medium',
    prompt: 'Jumlah lingkaran yang ada pada bendera Olimpiade adalah...',
    options: ['5', '4', '6', '7'],
    correctIndex: 0
  },
  {
    id: 'q_gen_120',
    category: 'general',
    topic: 'Pengetahuan Umum',
    difficulty: 'hard',
    prompt: 'Dalam bulu tangkis dengan sistem reli, satu gim dimenangkan saat pemain mencapai poin...',
    options: ['21', '15', '11', '25'],
    correctIndex: 0
  },
  {
    id: 'q_gen_121',
    category: 'general',
    topic: 'Pengetahuan Umum',
    difficulty: 'medium',
    prompt: 'Bahasa dengan jumlah penutur asli terbanyak di dunia adalah...',
    options: ['Mandarin', 'Inggris', 'Spanyol', 'Hindi'],
    correctIndex: 0
  },
  {
    id: 'q_gen_122',
    category: 'general',
    topic: 'Pengetahuan Umum',
    difficulty: 'medium',
    prompt: 'Mata uang resmi negara Thailand adalah...',
    options: ['Baht', 'Ringgit', 'Dong', 'Kip'],
    correctIndex: 0
  },
  {
    id: 'q_gen_123',
    category: 'general',
    topic: 'Pengetahuan Umum',
    difficulty: 'hard',
    prompt: 'Sel-sel sarang lebah madu berbentuk bangun...',
    options: ['Segi enam', 'Segi lima', 'Persegi', 'Segitiga'],
    correctIndex: 0
  },

  {
    id: 'q_math_033',
    category: 'math',
    topic: 'Persen',
    difficulty: 'medium',
    prompt: 'Berapakah 15% dari 240?',
    options: ['36', '24', '32', '40'],
    correctIndex: 0
  },
  {
    id: 'q_math_034',
    category: 'math',
    topic: 'Persen',
    difficulty: 'medium',
    prompt: 'Berapakah 25% dari 360?',
    options: ['90', '72', '80', '120'],
    correctIndex: 0
  },
  {
    id: 'q_math_035',
    category: 'math',
    topic: 'Persen',
    difficulty: 'hard',
    prompt: 'Harga baju Rp200.000 mendapat diskon 30%. Berapa yang harus dibayar?',
    options: ['Rp140.000', 'Rp170.000', 'Rp130.000', 'Rp160.000'],
    correctIndex: 0
  },
  {
    id: 'q_math_036',
    category: 'math',
    topic: 'Kuadrat & Akar',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 13 × 13?',
    options: ['169', '156', '149', '196'],
    correctIndex: 0
  },
  {
    id: 'q_math_037',
    category: 'math',
    topic: 'Kuadrat & Akar',
    difficulty: 'hard',
    prompt: 'Berapakah akar kuadrat dari 196?',
    options: ['14', '16', '13', '18'],
    correctIndex: 0
  },
  {
    id: 'q_math_038',
    category: 'math',
    topic: 'Kuadrat & Akar',
    difficulty: 'hard',
    prompt: 'Berapakah akar kuadrat dari 289?',
    options: ['17', '19', '16', '23'],
    correctIndex: 0
  },
  {
    id: 'q_math_039',
    category: 'math',
    topic: 'Pangkat',
    difficulty: 'hard',
    prompt: 'Berapakah hasil dari 2 pangkat 10?',
    options: ['1024', '512', '2048', '1000'],
    correctIndex: 0
  },
  {
    id: 'q_math_040',
    category: 'math',
    topic: 'Pangkat',
    difficulty: 'hard',
    prompt: 'Berapakah hasil dari 3 pangkat 5?',
    options: ['243', '81', '125', '729'],
    correctIndex: 0
  },
  {
    id: 'q_math_041',
    category: 'math',
    topic: 'Pola Bilangan',
    difficulty: 'hard',
    prompt: 'Lanjutkan pola bilangan: 2, 6, 12, 20, 30, ...',
    options: ['42', '40', '36', '44'],
    correctIndex: 0
  },
  {
    id: 'q_math_042',
    category: 'math',
    topic: 'Pola Bilangan',
    difficulty: 'medium',
    prompt: 'Lanjutkan pola bilangan: 1, 1, 2, 3, 5, 8, 13, ...',
    options: ['21', '18', '20', '26'],
    correctIndex: 0
  },
  {
    id: 'q_math_043',
    category: 'math',
    topic: 'Pola Bilangan',
    difficulty: 'medium',
    prompt: 'Lanjutkan pola bilangan: 3, 9, 27, 81, ...',
    options: ['243', '162', '324', '108'],
    correctIndex: 0
  },
  {
    id: 'q_math_044',
    category: 'math',
    topic: 'Pola Bilangan',
    difficulty: 'hard',
    prompt: 'Lanjutkan pola bilangan: 1, 4, 9, 16, 25, ...',
    options: ['36', '30', '35', '49'],
    correctIndex: 0
  },
  {
    id: 'q_math_045',
    category: 'math',
    topic: 'Perkalian',
    difficulty: 'hard',
    prompt: 'Berapakah hasil dari 17 × 6?',
    options: ['102', '96', '112', '106'],
    correctIndex: 0
  },
  {
    id: 'q_math_046',
    category: 'math',
    topic: 'Perkalian',
    difficulty: 'hard',
    prompt: 'Berapakah hasil dari 25 × 24?',
    options: ['600', '500', '625', '480'],
    correctIndex: 0
  },
  {
    id: 'q_math_047',
    category: 'math',
    topic: 'Perkalian',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 45 × 11?',
    options: ['495', '455', '505', '450'],
    correctIndex: 0
  },
  {
    id: 'q_math_048',
    category: 'math',
    topic: 'Perkalian',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 125 × 8?',
    options: ['1000', '800', '1250', '900'],
    correctIndex: 0
  },
  {
    id: 'q_math_049',
    category: 'math',
    topic: 'Pecahan',
    difficulty: 'hard',
    prompt: 'Berapakah 3/4 dari 84?',
    options: ['63', '56', '64', '72'],
    correctIndex: 0
  },
  {
    id: 'q_math_050',
    category: 'math',
    topic: 'Pecahan',
    difficulty: 'hard',
    prompt: 'Berapakah hasil dari 1/2 + 1/3?',
    options: ['5/6', '2/5', '1/6', '2/3'],
    correctIndex: 0
  },
  {
    id: 'q_math_051',
    category: 'math',
    topic: 'Pecahan',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 0,25 × 48?',
    options: ['12', '24', '8', '16'],
    correctIndex: 0
  },
  {
    id: 'q_math_052',
    category: 'math',
    topic: 'Operasi Campuran',
    difficulty: 'hard',
    prompt: 'Berapakah hasil dari (18 × 5) ÷ 6?',
    options: ['15', '12', '18', '20'],
    correctIndex: 0
  },
  {
    id: 'q_math_053',
    category: 'math',
    topic: 'Operasi Campuran',
    difficulty: 'hard',
    prompt: 'Berapakah hasil dari 7 × 8 + 8 × 3?',
    options: ['80', '192', '64', '88'],
    correctIndex: 0
  },
  {
    id: 'q_math_054',
    category: 'math',
    topic: 'Operasi Campuran',
    difficulty: 'medium',
    prompt: 'Berapakah hasil dari 1001 − 297?',
    options: ['704', '714', '694', '804'],
    correctIndex: 0
  },
  {
    id: 'q_math_055',
    category: 'math',
    topic: 'Soal Cerita',
    difficulty: 'hard',
    prompt: 'Mobil melaju 60 km/jam selama 2,5 jam. Berapa jarak yang ditempuh?',
    options: ['150 km', '120 km', '125 km', '160 km'],
    correctIndex: 0
  },
  {
    id: 'q_math_056',
    category: 'math',
    topic: 'Soal Cerita',
    difficulty: 'medium',
    prompt: 'Berapa jumlah detik dalam 1 jam?',
    options: ['3.600', '360', '6.000', '1.440'],
    correctIndex: 0
  },
  {
    id: 'q_math_057',
    category: 'math',
    topic: 'Soal Cerita',
    difficulty: 'hard',
    prompt: 'Rata-rata dari 12, 15, 18, dan 21 adalah...',
    options: ['16,5', '16', '17', '15,5'],
    correctIndex: 0
  },
  {
    id: 'q_math_058',
    category: 'math',
    topic: 'FPB & KPK',
    difficulty: 'hard',
    prompt: 'Berapakah FPB (faktor persekutuan terbesar) dari 24 dan 36?',
    options: ['12', '6', '8', '72'],
    correctIndex: 0
  },
  {
    id: 'q_math_059',
    category: 'math',
    topic: 'FPB & KPK',
    difficulty: 'medium',
    prompt: 'Berapakah KPK (kelipatan persekutuan terkecil) dari 6 dan 8?',
    options: ['24', '48', '12', '14'],
    correctIndex: 0
  },
  {
    id: 'q_math_060',
    category: 'math',
    topic: 'Geometri',
    difficulty: 'medium',
    prompt: 'Jumlah besar ketiga sudut dalam sebuah segitiga adalah...',
    options: ['180°', '360°', '90°', '270°'],
    correctIndex: 0
  }
];

function validateQuestionInput(input = {}) {
  const category = String(input.category || '').trim();
  if (category !== 'general' && category !== 'math') {
    return { valid: false, error: 'Kategori soal harus "general" atau "math".' };
  }
  const topic = String(input.topic || '').trim();
  if (!topic || topic.length > 60) {
    return { valid: false, error: 'Topik soal wajib diisi (maksimal 60 karakter).' };
  }
  const difficulty = String(input.difficulty || 'easy').trim();
  if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard') {
    return { valid: false, error: 'Tingkat kesulitan harus "easy", "medium", atau "hard".' };
  }
  const prompt = String(input.prompt || '').trim();
  if (prompt.length < 5 || prompt.length > 300) {
    return { valid: false, error: 'Teks pertanyaan harus antara 5 sampai 300 karakter.' };
  }
  if (!Array.isArray(input.options) || input.options.length !== 4) {
    return { valid: false, error: 'Pilihan jawaban harus berupa array berisi tepat 4 opsi.' };
  }
  const options = input.options.map(o => String(o ?? '').trim());
  if (options.some(o => !o || o.length > 120)) {
    return { valid: false, error: 'Setiap opsi jawaban wajib terisi (maksimal 120 karakter).' };
  }
  const uniqueOpts = new Set(options.map(o => o.toLowerCase()));
  if (uniqueOpts.size !== 4) {
    return { valid: false, error: 'Keempat opsi jawaban harus berbeda (tidak ambigu).' };
  }
  const correctIndex = Number(input.correctIndex);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
    return { valid: false, error: 'Indeks jawaban benar harus bilangan bulat 0..3.' };
  }
  return {
    valid: true,
    value: {
      id: input.id ? String(input.id).trim() : 'q_' + crypto.randomUUID(),
      category,
      topic,
      difficulty,
      prompt,
      options,
      correctIndex,
      active: input.active !== false
    }
  };
}

// Acak urutan opsi menggunakan Fisher-Yates dengan crypto.randomInt agar posisi jawaban benar tidak bisa ditebak
function buildRoundQuestionPayload(question, roundNo, maxRounds, startedAt, deadlineAt) {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const shuffledOptions = order.map(origIdx => question.options[origIdx]);
  const shuffledCorrectIndex = order.indexOf(question.correctIndex);

  return {
    optionOrder: order,
    shuffledCorrectIndex,
    // Payload publik yang aman dikirim ke kedua klien (TANPA jawaban benar!)
    clientQuestion: {
      id: question.id,
      roundNo,
      maxRounds,
      category: question.category,
      categoryLabel: question.category === 'math' ? 'Hitung Cepat' : 'Pengetahuan Umum',
      topic: question.topic,
      difficulty: question.difficulty,
      prompt: question.prompt,
      options: shuffledOptions,
      startedAt,
      deadlineAt,
      durationMs: deadlineAt - startedAt
    }
  };
}

module.exports = {
  SEED_QUESTIONS,
  validateQuestionInput,
  buildRoundQuestionPayload
};

