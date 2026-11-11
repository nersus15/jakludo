-- Migrasi 007: Dukungan reply bubble chat pada grup dan chat private (DM)

ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT;

