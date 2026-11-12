-- Migrasi 011: Tingkat kesulitan 'hard' untuk soal tantangan Monster Quiz Battle,
-- plus perbaikan teks dua soal bawaan (hanya jika belum diubah lewat admin).
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_difficulty_check;
ALTER TABLE quiz_questions ADD CONSTRAINT quiz_questions_difficulty_check
  CHECK (difficulty IN ('easy', 'medium', 'hard'));

UPDATE quiz_questions
SET prompt = 'Rumus kimia untuk senyawa air adalah...'
WHERE id = 'q_gen_012' AND prompt = 'Lambang unsur kimia untuk senyawa air adalah...';

UPDATE quiz_questions
SET prompt = 'Rendang, masakan daging berbumbu yang terkenal hingga ke mancanegara, berasal dari...'
WHERE id = 'q_gen_053'
  AND prompt = 'Makanan tradisional berbahan dasar daging rendang yang terkenal kelezatannya di seluruh dunia berasal dari...';
