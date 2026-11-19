// Item Hint Langkah untuk Chess Master:
// - Dipakai saat giliranmu di pertandingan catur yang sedang berjalan
// - Server menganalisis posisi saat itu dan menyorot langkah terbaik yang direkomendasikan
// - Satu item untuk satu rekomendasi
module.exports = {
  id: 'chessHint',
  name: 'Hint Langkah',
  icon: '💡',
  price: 100,
  game: 'chess',
  kind: 'active',
  badge: 'Chess Master',
  badgeColor: '#7c3aed',
  highlight: 'Rekomendasi langkah terbaik untuk posisi saat ini di Chess Master',
  description:
    'Bingung harus jalan apa? Server menganalisis posisi papan saat giliranmu dan menyorot langkah terbaik yang direkomendasikan. Satu item untuk satu rekomendasi.',

  canUse() {
    return 'Item Hint Langkah hanya digunakan di arena Chess Master.';
  },

  use() {}
};
