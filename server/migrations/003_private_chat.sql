-- Migrasi 003: chat private antar teman (teks, foto WebP, voice note MP3 di MinIO S3)

CREATE TABLE IF NOT EXISTS direct_messages (
  id TEXT PRIMARY KEY,
  pair_key TEXT NOT NULL,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'audio')),
  text TEXT NOT NULL DEFAULT '',
  media_key TEXT,
  media_mime TEXT,
  media_size INTEGER,
  media_width INTEGER,
  media_height INTEGER,
  media_duration_ms INTEGER,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS direct_messages_pair_time_idx
  ON direct_messages (pair_key, created_at DESC, id DESC);

