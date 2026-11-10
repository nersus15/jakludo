-- Migrasi 002: fitur sosial (teman, grup, undangan grup, chat grup, leaderboard grup)

-- Pertemanan disimpan satu baris per pasangan dengan user_low < user_high agar tidak dobel.
CREATE TABLE IF NOT EXISTS friendships (
  user_low TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (user_low, user_high),
  CHECK (user_low < user_high)
);

CREATE INDEX IF NOT EXISTS friendships_user_high_idx ON friendships (user_high);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at BIGINT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS group_members_user_idx ON group_members (user_id);

CREATE TABLE IF NOT EXISTS group_invites (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  inviter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  UNIQUE (group_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS group_invites_invitee_idx ON group_invites (invitee_id);

-- Pesan grup. File media disimpan di MinIO (media_key), bukan di database.
CREATE TABLE IF NOT EXISTS group_messages (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'audio', 'system', 'match')),
  text TEXT NOT NULL DEFAULT '',
  media_key TEXT,
  media_mime TEXT,
  media_size INTEGER,
  media_width INTEGER,
  media_height INTEGER,
  media_duration_ms INTEGER,
  match_code TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS group_messages_group_time_idx ON group_messages (group_id, created_at DESC, id DESC);

-- Leaderboard khusus grup: hanya diisi dari match grup, terpisah dari leaderboard global
CREATE TABLE IF NOT EXISTS group_leaderboard (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wins INTEGER NOT NULL DEFAULT 0,
  matches_played INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, user_id)
);

