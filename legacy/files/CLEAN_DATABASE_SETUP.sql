-- ═══════════════════════════════════════════════════════════
-- FLEETOSV3 - CLEAN DATABASE SETUP
-- Copy this entire file and run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. CREATE ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  dealer_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREATE CARS TABLE
CREATE TABLE IF NOT EXISTS cars (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  stock_number TEXT,
  reg TEXT,
  make TEXT,
  model TEXT,
  type TEXT DEFAULT 'owned',
  paid NUMERIC,
  sold NUMERIC,
  purchase_date DATE,
  sale_date DATE,
  status TEXT,
  owner_name TEXT,
  min_price NUMERIC,
  sale_price NUMERIC,
  received_date DATE,
  fee NUMERIC,
  fee_vat TEXT DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CREATE TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE,
  supplier TEXT,
  type TEXT,
  amount NUMERIC,
  vat TEXT,
  method TEXT,
  thirty_day BOOLEAN DEFAULT FALSE,
  due_date DATE,
  status TEXT,
  notes TEXT,
  car_reg TEXT,
  stock_id BIGINT REFERENCES cars(id),
  source TEXT DEFAULT 'manual',
  assigned BOOLEAN DEFAULT TRUE,
  qb_id TEXT UNIQUE,
  qb_type TEXT,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CREATE BALANCE SHEET TABLE
CREATE TABLE IF NOT EXISTS balance_sheet (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  acc1 NUMERIC DEFAULT 0,
  acc2 NUMERIC DEFAULT 0,
  parts30 NUMERIC DEFAULT 0,
  mech30 NUMERIC DEFAULT 0,
  debtors NUMERIC DEFAULT 0,
  other_liab NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CREATE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  UNIQUE(account_id, key)
);

-- 6. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_cars_account_id ON cars(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_balance_sheet_account_id ON balance_sheet(account_id);
CREATE INDEX IF NOT EXISTS idx_settings_account_id ON settings(account_id);

-- 7. DISABLE RLS (for now - we'll add proper policies later)
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE cars DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE balance_sheet DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- 8. CREATE YOUR DEALERSHIP ACCOUNT
INSERT INTO accounts (dealer_name, active)
SELECT 'THG Automotive', true
WHERE NOT EXISTS (
  SELECT 1 FROM accounts WHERE dealer_name = 'THG Automotive'
);

-- 9. CREATE INITIAL BALANCE SHEET
INSERT INTO balance_sheet (account_id, acc1, acc2, parts30, mech30, debtors, other_liab)
SELECT id, 0, 0, 0, 0, 0, 0
FROM accounts
WHERE dealer_name = 'THG Automotive'
  AND NOT EXISTS (
    SELECT 1 FROM balance_sheet 
    WHERE account_id = (SELECT id FROM accounts WHERE dealer_name = 'THG Automotive')
  );

-- 10. VERIFY SETUP
SELECT 
  'Setup Complete!' as status,
  (SELECT COUNT(*) FROM accounts) as accounts,
  (SELECT COUNT(*) FROM cars) as cars,
  (SELECT COUNT(*) FROM transactions) as transactions;

-- 9. SHOW YOUR ACCOUNT
SELECT 
  id,
  dealer_name,
  user_id,
  active,
  created_at
FROM accounts
WHERE dealer_name = 'THG Automotive';

-- ═══════════════════════════════════════════════════════════
-- NEXT STEPS:
-- ═══════════════════════════════════════════════════════════
-- 1. Go to Supabase → Authentication → Users
-- 2. Click "Add User"
-- 3. Email: max@thgautomotive.com
-- 4. Password: (your choice)
-- 5. Auto Confirm: YES
-- 6. Copy the User ID (UUID)
-- 7. Run this command (replace UUID):
--
-- UPDATE accounts 
-- SET user_id = 'YOUR-UUID-HERE'::uuid
-- WHERE dealer_name = 'THG Automotive';
--
-- 8. Open FleetOS_v3_CLEAN.html and login!
-- ═══════════════════════════════════════════════════════════
