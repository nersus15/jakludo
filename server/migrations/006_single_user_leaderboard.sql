-- Migrasi 006: Kembalikan leaderboard ke 1 baris per pemain (user_id PRIMARY KEY)
-- Leaderboard grup ditampilkan dari tabel leaderboard yang sama lewat query JOIN group_members.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'leaderboard'
      AND column_name = 'group_id'
  ) THEN
    -- Jumlahkan skor tambahan dari baris grup ke baris global masing-masing user
    WITH grp_extra AS (
      SELECT
        user_id,
        COALESCE(SUM(wins), 0)::INTEGER AS extra_wins,
        COALESCE(SUM(matches_played), 0)::INTEGER AS extra_matches,
        COALESCE(SUM(points), 0)::INTEGER AS extra_points
      FROM leaderboard
      WHERE group_id IS NOT NULL
      GROUP BY user_id
    )
    UPDATE leaderboard l
    SET
      wins = l.wins + g.extra_wins,
      matches_played = l.matches_played + g.extra_matches,
      points = l.points + g.extra_points
    FROM grp_extra g
    WHERE l.user_id = g.user_id AND l.group_id IS NULL;

    -- Jika ada user yang hanya punya baris grup tanpa baris global, promosikan jadi baris utama
    INSERT INTO leaderboard (user_id, group_id, username, name, avatar, wins, matches_played, points, auth_type)
    SELECT
      g.user_id,
      NULL,
      COALESCE(MAX(g.username), u.username),
      COALESCE(MAX(g.name), u.name),
      COALESCE(MAX(g.avatar), u.avatar, '🎯'),
      COALESCE(SUM(g.wins), 0)::INTEGER,
      COALESCE(SUM(g.matches_played), 0)::INTEGER,
      COALESCE(SUM(g.points), 0)::INTEGER + 200,
      COALESCE(MAX(g.auth_type), u.auth_type, 'password')
    FROM leaderboard g
    JOIN users u ON u.id = g.user_id
    WHERE g.group_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM leaderboard gl WHERE gl.user_id = g.user_id AND gl.group_id IS NULL
      )
    GROUP BY g.user_id, u.username, u.name, u.avatar, u.auth_type;

    DELETE FROM leaderboard WHERE group_id IS NOT NULL;

    DROP INDEX IF EXISTS leaderboard_global_ranking_idx;
    DROP INDEX IF EXISTS leaderboard_group_ranking_idx;
    DROP INDEX IF EXISTS leaderboard_global_user_uidx;
    DROP INDEX IF EXISTS leaderboard_group_user_uidx;
    ALTER TABLE leaderboard DROP CONSTRAINT IF EXISTS leaderboard_pkey;
    ALTER TABLE leaderboard DROP COLUMN IF EXISTS group_id;
    ALTER TABLE leaderboard DROP COLUMN IF EXISTS id;
    ALTER TABLE leaderboard ADD PRIMARY KEY (user_id);
    CREATE INDEX IF NOT EXISTS leaderboard_ranking_idx ON leaderboard (wins DESC, points DESC);
  END IF;

  IF to_regclass('group_leaderboard') IS NOT NULL THEN
    DROP TABLE group_leaderboard;
  END IF;
END $$;

