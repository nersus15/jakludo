-- Migrasi 001: Skema awal PostgreSQL untuk JakLudo
-- Tidak membutuhkan ekstensi superuser (case-insensitive username memakai indeks LOWER(username)).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT,
  auth_type TEXT NOT NULL DEFAULT 'password',
  avatar TEXT,
  email TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username));

CREATE TABLE IF NOT EXISTS user_items (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  PRIMARY KEY (user_id, item_id)
);

-- Token disimpan sebagai hash SHA-256: kebocoran database tidak membocorkan token sesi aktif
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

-- user_id tanpa foreign key ketat agar data historis tetap aman
CREATE TABLE IF NOT EXISTS leaderboard (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT,
  wins INTEGER NOT NULL DEFAULT 0,
  matches_played INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  auth_type TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS leaderboard_ranking_idx ON leaderboard (wins DESC, points DESC);

-- Snapshot room yang sedang berjalan agar permainan selamat dari restart/deploy server
CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at BIGINT NOT NULL
);

