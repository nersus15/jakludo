-- Migrasi 023: Item "Hint Langkah" untuk Chess Master (100 Coins, item aktif).
-- Hanya ditambahkan bila belum ada, supaya harga/teks yang sudah diubah admin tidak tertimpa.
INSERT INTO shop_items (id, name, price, game, icon, description, kind, badge, badge_color, highlight, target, sound, protects, sort_order, is_active)
VALUES (
  'chessHint',
  'Hint Langkah',
  100,
  'chess',
  '💡',
  'Bingung harus jalan apa? Server menganalisis posisi papan saat giliranmu dan menyorot langkah terbaik yang direkomendasikan. Satu item untuk satu rekomendasi.',
  'active',
  'Chess Master',
  '#7c3aed',
  'Rekomendasi langkah terbaik untuk posisi saat ini di Chess Master',
  NULL,
  'chime',
  '[]'::jsonb,
  5,
  TRUE
)
ON CONFLICT (id) DO NOTHING;
