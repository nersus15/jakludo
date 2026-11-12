-- Migrasi 009: Monster Quiz Battle (mode permainan kedua di JakLudo)
-- Semua tabel memakai prefix quiz_ agar terpisah total dari tabel Ludo (leaderboard, rooms).
-- Tabel users JakLudo dipakai ulang lewat foreign key; tidak ada tabel user baru.

-- Katalog monster (data seed dari server/quiz/monsters.js; visual ada di klien)
CREATE TABLE IF NOT EXISTS quiz_monsters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  element TEXT NOT NULL,
  description TEXT NOT NULL,
  base_hp INTEGER NOT NULL DEFAULT 100 CHECK (base_hp BETWEEN 1 AND 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Bank soal. Jawaban benar hanya disimpan di server. Siap dikelola admin panel (active, updated_at).
CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('general', 'math')),
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium')),
  prompt TEXT NOT NULL,
  options JSONB NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4),
  correct_index SMALLINT NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  meta JSONB,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS quiz_questions_active_idx ON quiz_questions (category) WHERE active;

-- Room (lobi) Monster Quiz Battle; satu room bisa memainkan beberapa pertandingan (main ulang)
CREATE TABLE IF NOT EXISTS quiz_rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'code' CHECK (source IN ('code', 'matchmaking')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'playing', 'closed')),
  created_at BIGINT NOT NULL,
  closed_at BIGINT
);

-- Kode room hanya unik selama room masih terbuka (kode boleh dipakai ulang setelah ditutup)
CREATE UNIQUE INDEX IF NOT EXISTS quiz_rooms_open_code_uidx ON quiz_rooms (code) WHERE status <> 'closed';

CREATE TABLE IF NOT EXISTS quiz_room_players (
  room_id TEXT NOT NULL REFERENCES quiz_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot SMALLINT NOT NULL CHECK (slot IN (0, 1, 2)),
  monster_id TEXT REFERENCES quiz_monsters(id),
  joined_at BIGINT NOT NULL,
  left_at BIGINT,
  PRIMARY KEY (room_id, user_id),
  UNIQUE (room_id, slot)
);

CREATE TABLE IF NOT EXISTS quiz_matches (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES quiz_rooms(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'finished', 'abandoned')),
  winner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  end_reason TEXT CHECK (end_reason IN ('knockout', 'questions_exhausted', 'forfeit', 'abandoned', 'server_restart')),
  max_rounds INTEGER NOT NULL CHECK (max_rounds > 0),
  rounds_played INTEGER NOT NULL DEFAULT 0 CHECK (rounds_played >= 0),
  started_at BIGINT NOT NULL,
  finished_at BIGINT
);

CREATE INDEX IF NOT EXISTS quiz_matches_status_idx ON quiz_matches (status);

-- Peserta per pertandingan: monster pilihan, HP awal, HP saat ini, dan hasil akhir
CREATE TABLE IF NOT EXISTS quiz_match_players (
  match_id TEXT NOT NULL REFERENCES quiz_matches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot SMALLINT NOT NULL CHECK (slot IN (0, 1, 2)),
  monster_id TEXT NOT NULL REFERENCES quiz_monsters(id),
  start_hp INTEGER NOT NULL CHECK (start_hp BETWEEN 0 AND 100),
  current_hp INTEGER NOT NULL CHECK (current_hp BETWEEN 0 AND 100),
  correct_answers INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  result TEXT CHECK (result IN ('win', 'lose', 'draw', 'none')),
  PRIMARY KEY (match_id, user_id),
  UNIQUE (match_id, slot)
);

CREATE INDEX IF NOT EXISTS quiz_match_players_user_idx ON quiz_match_players (user_id);

-- Satu baris per ronde. UNIQUE (match_id, question_id) menjamin soal tidak berulang dalam satu pertandingan.
CREATE TABLE IF NOT EXISTS quiz_rounds (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES quiz_matches(id) ON DELETE CASCADE,
  round_no INTEGER NOT NULL CHECK (round_no > 0),
  question_id TEXT NOT NULL REFERENCES quiz_questions(id),
  option_order JSONB NOT NULL,
  started_at BIGINT NOT NULL,
  deadline_at BIGINT NOT NULL,
  resolved_at BIGINT NOT NULL,
  attacker_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  damage INTEGER NOT NULL DEFAULT 0 CHECK (damage IN (0, 10)),
  UNIQUE (match_id, round_no),
  UNIQUE (match_id, question_id)
);

-- Satu jawaban per pemain per ronde (PRIMARY KEY mencegah jawaban ganda di level database)
CREATE TABLE IF NOT EXISTS quiz_answers (
  round_id TEXT NOT NULL REFERENCES quiz_rounds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_index SMALLINT CHECK (selected_index BETWEEN 0 AND 3),
  is_correct BOOLEAN NOT NULL,
  timed_out BOOLEAN NOT NULL DEFAULT FALSE,
  answered_at BIGINT,
  response_ms INTEGER CHECK (response_ms >= 0),
  PRIMARY KEY (round_id, user_id)
);

-- Statistik Monster Quiz Battle, terpisah dari tabel leaderboard Ludo
CREATE TABLE IF NOT EXISTS quiz_player_stats (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  matches_played INTEGER NOT NULL DEFAULT 0 CHECK (matches_played >= 0),
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  draws INTEGER NOT NULL DEFAULT 0 CHECK (draws >= 0),
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS quiz_player_stats_ranking_idx ON quiz_player_stats (wins DESC, matches_played ASC);

