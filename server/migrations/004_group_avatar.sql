-- Migrasi 004: kolom avatar pada tabel groups untuk menyimpan foto profil grup (di MinIO S3)

ALTER TABLE groups ADD COLUMN IF NOT EXISTS avatar TEXT;

