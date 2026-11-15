-- PlayGo Dual Currency (Coins + Diamonds), Duitku Top-Up & JakLudo Skin Shop

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'player';

CREATE TABLE IF NOT EXISTS economy_settings (
  id INT PRIMARY KEY DEFAULT 1,
  coins_per_diamond INT NOT NULL DEFAULT 100 CHECK (coins_per_diamond >= 1),
  min_convert_diamonds INT NOT NULL DEFAULT 10 CHECK (min_convert_diamonds >= 1),
  max_convert_diamonds INT NOT NULL DEFAULT 50 CHECK (max_convert_diamonds >= min_convert_diamonds),
  conversion_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

INSERT INTO economy_settings (id, coins_per_diamond, min_convert_diamonds, max_convert_diamonds, conversion_enabled)
VALUES (1, 100, 10, 50, TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS diamond_wallets (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_purchased INT NOT NULL DEFAULT 0,
  total_converted INT NOT NULL DEFAULT 0,
  total_spent INT NOT NULL DEFAULT 0,
  total_refunded INT NOT NULL DEFAULT 0,
  total_admin_adjusted INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diamond_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('TOPUP', 'CONVERSION', 'SKIN_PURCHASE', 'REFUND', 'ADMIN_ADJUSTMENT')),
  amount INT NOT NULL,
  previous_balance INT NOT NULL CHECK (previous_balance >= 0),
  new_balance INT NOT NULL CHECK (new_balance >= 0),
  reference_id TEXT,
  idempotency_key TEXT UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diamond_tx_user_created
  ON diamond_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diamond_tx_type_created
  ON diamond_transactions (tx_type, created_at DESC);

CREATE TABLE IF NOT EXISTS coin_conversion_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coins_spent INT NOT NULL CHECK (coins_spent > 0),
  diamonds_received INT NOT NULL CHECK (diamonds_received > 0),
  rate_coins_per_diamond INT NOT NULL CHECK (rate_coins_per_diamond > 0),
  previous_coins INT NOT NULL CHECK (previous_coins >= 0),
  new_coins INT NOT NULL CHECK (new_coins >= 0),
  previous_diamonds INT NOT NULL CHECK (previous_diamonds >= 0),
  new_diamonds INT NOT NULL CHECK (new_diamonds >= 0),
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_conv_user_created
  ON coin_conversion_transactions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS diamond_topup_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  diamonds INT NOT NULL CHECK (diamonds > 0),
  bonus_diamonds INT NOT NULL DEFAULT 0 CHECK (bonus_diamonds >= 0),
  price_idr INT NOT NULL CHECK (price_idr > 0),
  badge TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO diamond_topup_packages (id, name, diamonds, bonus_diamonds, price_idr, badge, sort_order, is_active)
VALUES
  ('pkg_starter', 'Starter', 10, 0, 5000, 'Hemat', 1, TRUE),
  ('pkg_popular', 'Popular', 25, 0, 10000, 'Populer', 2, TRUE),
  ('pkg_premium', 'Premium', 50, 0, 20000, 'Best Value', 3, TRUE),
  ('pkg_mega', 'Mega', 150, 0, 50000, 'Sultan', 4, TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  diamonds INT NOT NULL CHECK (diamonds > 0),
  bonus_diamonds INT NOT NULL DEFAULT 0 CHECK (bonus_diamonds >= 0),
  total_diamonds INT NOT NULL CHECK (total_diamonds > 0),
  amount_idr INT NOT NULL CHECK (amount_idr > 0),
  payment_method TEXT NOT NULL DEFAULT '',
  gateway TEXT NOT NULL DEFAULT 'duitku',
  gateway_reference TEXT,
  payment_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED')),
  credited_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  failure_reason TEXT,
  raw_create_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_created
  ON payment_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status
  ON payment_orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_callback_logs (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  gateway TEXT NOT NULL DEFAULT 'duitku',
  merchant_code TEXT,
  amount_raw TEXT,
  result_code TEXT,
  signature_received TEXT,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  processing_status TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_callback_logs_order
  ON payment_callback_logs (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ludo_skins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_diamonds INT NOT NULL CHECK (price_diamonds >= 1),
  rarity TEXT NOT NULL DEFAULT 'Common' CHECK (rarity IN ('Common', 'Rare', 'Epic', 'Legendary')),
  asset_key TEXT NOT NULL,
  preview_url TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  accent_color TEXT NOT NULL DEFAULT '#fbbf24',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ludo_skins (id, name, description, price_diamonds, rarity, asset_key, accent_color, is_active, sort_order)
VALUES
  ('classic_gold', 'Classic Gold', 'Bidak emas klasik berlapis kilau mewah untuk gaya juara sejati.', 10, 'Common', 'classic_gold', '#f59e0b', TRUE, 1),
  ('ruby_crystal', 'Ruby Crystal', 'Kristal delima merah menyala dengan potongan faset permata elegan.', 15, 'Common', 'ruby_crystal', '#ef4444', TRUE, 2),
  ('ocean_blue', 'Ocean Blue', 'Bidak biru samudra dengan inti mutiara laut yang tenang dan berkelas.', 20, 'Rare', 'ocean_blue', '#0ea5e9', TRUE, 3),
  ('emerald_green', 'Emerald Green', 'Zamrud hijau berkilau dengan aura hutan mistis yang tajam di papan.', 25, 'Rare', 'emerald_green', '#10b981', TRUE, 4),
  ('galaxy_purple', 'Galaxy Purple', 'Bidak nebula ungu kosmik bertabur bintang untuk penakluk arena.', 30, 'Epic', 'galaxy_purple', '#8b5cf6', TRUE, 5),
  ('fire_phoenix', 'Fire Phoenix', 'Sayap api phoenix membara yang memancarkan semangat pantang menyerah.', 40, 'Epic', 'fire_phoenix', '#f97316', TRUE, 6),
  ('legendary_diamond', 'Legendary Diamond', 'Bidak berlian legendaris berlapis mahkota kristal tertinggi di PlayGo.', 50, 'Legendary', 'legendary_diamond', '#38bdf8', TRUE, 7)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_ludo_skins (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skin_id TEXT NOT NULL REFERENCES ludo_skins(id) ON DELETE CASCADE,
  purchase_tx_id TEXT,
  price_paid_diamonds INT NOT NULL DEFAULT 0,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, skin_id)
);

CREATE TABLE IF NOT EXISTS user_ludo_equipped_skins (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  skin_id TEXT REFERENCES ludo_skins(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
