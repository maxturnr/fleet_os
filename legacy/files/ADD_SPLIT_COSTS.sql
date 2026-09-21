-- ═══════════════════════════════════════════════════════════
-- ADD SPLIT COST FEATURE
-- Run this in Supabase SQL Editor to add split cost support
-- ═══════════════════════════════════════════════════════════

-- 1. CREATE TRANSACTION SPLITS TABLE
CREATE TABLE IF NOT EXISTS transaction_splits (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  car_id BIGINT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREATE INDEX FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction_id ON transaction_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_car_id ON transaction_splits(car_id);

-- 3. DISABLE RLS
ALTER TABLE transaction_splits DISABLE ROW LEVEL SECURITY;

-- 4. VERIFY
SELECT 
  'Split costs table created!' as status,
  (SELECT COUNT(*) FROM transaction_splits) as splits_count;
