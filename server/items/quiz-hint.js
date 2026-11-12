// Item Hint Jawaban untuk Monster Quiz Battle:
// - Dipakai saat ronde pertanyaan (15 detik) sedang berlangsung di Monster Quiz Battle
// - Mengeliminasi 2 opsi jawaban yang salah (50:50) pada ronde tersebut sehingga tersisa 2 pilihan
// - Maksimal 1 Hint per ronde per pemain
module.exports = {
  id: 'quizHint',
  name: 'Hints Jawaban',
  icon: '💡',
  price: 25,
  game: 'quiz',
  kind: 'active',
  badge: 'Monster Quiz',
  badgeColor: '#3b82f6',
  highlight: 'Eliminasi 2 opsi jawaban salah (50:50) saat duel Monster Quiz Battle',
  description:
    'Bantuan pintar saat ragu menjawab soal di Monster Quiz Battle! Menghilangkan 2 pilihan jawaban yang salah (50:50) pada ronde yang sedang berlangsung sehingga peluang benar meningkat tajam. Maksimal 1 Hint per ronde.',

  canUse() {
    return 'Item Hints Jawaban hanya digunakan di arena Monster Quiz Battle.';
  },

  use() {}
};

