-- Migrasi 014: Rotasi soal Monster Quiz Battle.
-- cycle_seen menandai soal yang sudah muncul di siklus ini. Soal yang sudah muncul diberi peluang
-- kecil sampai semua soal aktif sekategori pernah muncul, lalu tandanya di-reset.
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS cycle_seen BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS shown_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS last_shown_at BIGINT;

-- Soal yang sudah pernah dipakai di ronde sebelumnya dianggap sudah muncul pada siklus pertama
UPDATE quiz_questions q
SET shown_count = s.cnt, last_shown_at = s.last_at, cycle_seen = TRUE
FROM (
  SELECT question_id, COUNT(*)::int AS cnt, MAX(started_at) AS last_at
  FROM quiz_rounds
  GROUP BY question_id
) s
WHERE q.id = s.question_id AND q.shown_count = 0;
