// Bank soal Monster Quiz Battle (94 soal tervalidasi: 62 Pengetahuan Umum + 32 Hitung-hitungan Cepat)
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
    prompt: 'Lambang unsur kimia untuk senyawa air adalah...',
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
    prompt: 'Makanan tradisional berbahan dasar daging rendang yang terkenal kelezatannya di seluruh dunia berasal dari...',
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
  if (difficulty !== 'easy' && difficulty !== 'medium') {
    return { valid: false, error: 'Tingkat kesulitan harus "easy" atau "medium".' };
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

