-- Migrasi 022: Sistem Kode Referral & Hadiah Koin
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique_idx ON users (referral_code) WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  reward_points INTEGER NOT NULL DEFAULT 50,
  created_at TEXT NOT NULL,
  UNIQUE(referred_user_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_id);
