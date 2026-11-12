-- Migrasi 008: tanggal (WIB, YYYY-MM-DD) terakhir pemain menerima bonus harian.
-- Sebelumnya file ini bernomor 007 dan bentrok dengan 007_chat_reply.sql (versi migrasi harus unik).
-- Seluruh perintah idempoten sehingga aman untuk database mana pun yang sudah mencatat versi 7,
-- baik yang dulu menjalankan chat_reply maupun daily_bonus.
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS last_daily_bonus TEXT;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT;

