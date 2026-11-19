-- Dukungan konversi dua arah (termasuk Diamonds -> Coins) pada coin_conversion_transactions
ALTER TABLE coin_conversion_transactions
  DROP CONSTRAINT IF EXISTS coin_conversion_transactions_coins_spent_check,
  DROP CONSTRAINT IF EXISTS coin_conversion_transactions_diamonds_received_check;

ALTER TABLE coin_conversion_transactions
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'diamonds_to_coins',
  ADD COLUMN IF NOT EXISTS diamonds_spent INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_received INT NOT NULL DEFAULT 0;

ALTER TABLE coin_conversion_transactions
  ADD CONSTRAINT coin_conversion_transactions_coins_spent_check CHECK (coins_spent >= 0),
  ADD CONSTRAINT coin_conversion_transactions_diamonds_received_check CHECK (diamonds_received >= 0),
  ADD CONSTRAINT coin_conversion_transactions_diamonds_spent_check CHECK (diamonds_spent >= 0),
  ADD CONSTRAINT coin_conversion_transactions_coins_received_check CHECK (coins_received >= 0);
