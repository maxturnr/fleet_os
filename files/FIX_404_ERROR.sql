-- ═══════════════════════════════════════════
-- FIX 404 ERROR - CREATE ALL REQUIRED TABLES
-- Run this in Supabase SQL Editor to fix the login 404 error
-- 
-- This script is safe to run multiple times - it won't duplicate data
-- ═══════════════════════════════════════════

-- 1. Create accounts table (THIS IS WHAT'S MISSING!)
CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  dealer_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_email TEXT,
  primary_user_name TEXT
);

-- 2. Create cars table if it doesn't exist
CREATE TABLE IF NOT EXISTS cars (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'owned',
  stock_number TEXT,
  reg TEXT,
  make TEXT,
  model TEXT,
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

-- 3. Create transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
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
  stock_id BIGINT,
  source TEXT DEFAULT 'manual',
  assigned BOOLEAN DEFAULT TRUE,
  qb_id TEXT UNIQUE,
  qb_type TEXT,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create balance_sheet table if it doesn't exist
CREATE TABLE IF NOT EXISTS balance_sheet (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  acc1 NUMERIC DEFAULT 0,
  acc2 NUMERIC DEFAULT 0,
  parts30 NUMERIC DEFAULT 0,
  mech30 NUMERIC DEFAULT 0,
  debtors NUMERIC DEFAULT 0,
  other_liab NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS settings (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, key)
);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_cars_account_id ON cars(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_balance_sheet_account_id ON balance_sheet(account_id);
CREATE INDEX IF NOT EXISTS idx_settings_account_id ON settings(account_id);

-- 7. Disable RLS (Row Level Security) for now
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE cars DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE balance_sheet DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- 8. Create THG Automotive account (only if it doesn't exist)
INSERT INTO accounts (dealer_name, primary_email, primary_user_name, active)
SELECT 'THG Automotive', 'max@thgautomotive.com', 'Max Turner', true
WHERE NOT EXISTS (
  SELECT 1 FROM accounts WHERE dealer_name = 'THG Automotive'
);

-- 9. Create initial balance sheet entry for THG Automotive
INSERT INTO balance_sheet (account_id, acc1, acc2, parts30, mech30, debtors, other_liab)
SELECT id, 0, 0, 0, 0, 0, 0
FROM accounts
WHERE dealer_name = 'THG Automotive'
  AND NOT EXISTS (
    SELECT 1 FROM balance_sheet 
    WHERE account_id = (SELECT id FROM accounts WHERE dealer_name = 'THG Automotive')
  );

-- 10. Create initial settings for THG Automotive
INSERT INTO settings (account_id, key, value)
SELECT id, 'vat_registered', 'false'
FROM accounts
WHERE dealer_name = 'THG Automotive'
  AND NOT EXISTS (
    SELECT 1 FROM settings 
    WHERE account_id = (SELECT id FROM accounts WHERE dealer_name = 'THG Automotive')
      AND key = 'vat_registered'
  );

INSERT INTO settings (account_id, key, value)
SELECT id, 'qb_connected', 'false'
FROM accounts
WHERE dealer_name = 'THG Automotive'
  AND NOT EXISTS (
    SELECT 1 FROM settings 
    WHERE account_id = (SELECT id FROM accounts WHERE dealer_name = 'THG Automotive')
      AND key = 'qb_connected'
  );

-- 11. Verify tables were created
SELECT 
  'Tables Created' as status,
  COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('accounts', 'cars', 'transactions', 'balance_sheet', 'settings');

-- 12. Show THG Automotive account
SELECT 
  id,
  dealer_name,
  user_id,
  primary_email,
  active,
  created_at
FROM accounts
WHERE dealer_name = 'THG Automotive';

-- ═══════════════════════════════════════════
-- NEXT STEPS AFTER RUNNING THIS:
-- ═══════════════════════════════════════════
-- 1. Go to Supabase → Authentication → Users
-- 2. Click "Add User"
-- 3. Email: max@thgautomotive.com
-- 4. Password: (your choice)
-- 5. Auto Confirm: YES
-- 6. Copy the User ID (UUID)
-- 7. Run this command (replace UUID):
--
-- UPDATE accounts 
-- SET user_id = 'YOUR-USER-UUID-HERE'::uuid
-- WHERE dealer_name = 'THG Automotive';
--
-- 8. Test login at FleetOS_v2.html
-- ═══════════════════════════════════════════
