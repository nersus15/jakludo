-- Migrasi 005: Gabungkan leaderboard global dan grup ke satu tabel leaderboard
-- group_id IS NULL = leaderboard global; group_id = '<id>' = leaderboard grup tersebut.

ALTER TABLE leaderboard DROP CONSTRAINT IF EXISTS leaderboard_pkey;
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS id BIGSERIAL PRIMARY KEY;
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS group_id TEXT REFERENCES groups(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS leaderboard_ranking_idx;
CREATE INDEX IF NOT EXISTS leaderboard_global_ranking_idx
  ON leaderboard (wins DESC, points DESC)
  WHERE group_id IS NULL;
CREATE INDEX IF NOT EXISTS leaderboard_group_ranking_idx
  ON leaderboard (group_id, wins DESC, points DESC)
  WHERE group_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_global_user_uidx
  ON leaderboard (user_id)
  WHERE group_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_group_user_uidx
  ON leaderboard (group_id, user_id)
  WHERE group_id IS NOT NULL;

DO $$
BEGIN
  IF to_regclass('group_leaderboard') IS NOT NULL THEN
    INSERT INTO leaderboard (user_id, group_id, username, name, avatar, wins, matches_played, points, auth_type)
    SELECT
      gl.user_id,
      gl.group_id,
      u.username,
      u.name,
      COALESCE(u.avatar, '🎯'),
      gl.wins,
      gl.matches_played,
      gl.points,
      u.auth_type
    FROM group_leaderboard gl
    JOIN users u ON u.id = gl.user_id
    ON CONFLICT (group_id, user_id) WHERE group_id IS NOT NULL DO UPDATE SET
      username = EXCLUDED.username,
      name = EXCLUDED.name,
      avatar = COALESCE(EXCLUDED.avatar, leaderboard.avatar),
      wins = GREATEST(leaderboard.wins, EXCLUDED.wins),
      matches_played = GREATEST(leaderboard.matches_played, EXCLUDED.matches_played),
      points = GREATEST(leaderboard.points, EXCLUDED.points);

    DROP TABLE group_leaderboard;
  END IF;
END $$;

