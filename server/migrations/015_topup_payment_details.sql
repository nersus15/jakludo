-- Migrasi 015: Tambah payment_details ke topup_orders untuk Midtrans Core API
ALTER TABLE topup_orders ADD COLUMN IF NOT EXISTS payment_details JSONB;

