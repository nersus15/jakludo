-- Migrasi 012: Tabel Order Topup Diamonds / Points via Midtrans
CREATE TABLE IF NOT EXISTS topup_orders (
  order_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL,
  diamonds INTEGER NOT NULL,
  gross_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  snap_token TEXT,
  payment_type TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS topup_orders_user_idx ON topup_orders(user_id);
CREATE INDEX IF NOT EXISTS topup_orders_status_idx ON topup_orders(status);

