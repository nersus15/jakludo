-- Migrasi 011: Dukungan Google OAuth / Sign In with Google
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx ON users (google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email)) WHERE email IS NOT NULL;

