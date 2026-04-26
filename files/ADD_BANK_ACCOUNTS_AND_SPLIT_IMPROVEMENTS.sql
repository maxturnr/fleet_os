-- ═══════════════════════════════════════════════════════════
-- ADD BANK ACCOUNTS & IMPROVE TRANSACTION SPLITTING
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. CREATE BANK ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS bank_accounts (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  account_type TEXT DEFAULT 'Current',
  account_number TEXT,
  sort_code TEXT,
  is_default BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ADD QUICKBOOKS REFERENCE TO BANK ACCOUNTS
ALTER TABLE bank_accounts
ADD COLUMN IF NOT EXISTS qb_account_id TEXT;

-- 3. ADD BANK ACCOUNT REFERENCE TO TRANSACTIONS
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS bank_account_id BIGINT REFERENCES bank_accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS qb_transaction_id TEXT;

-- 3. ADD PARENT TRANSACTION REFERENCE FOR SPLITS
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS parent_transaction_id BIGINT REFERENCES transactions(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_split BOOLEAN DEFAULT false;

-- 4. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_bank_accounts_account_id ON bank_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_bank_account_id ON transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_parent_id ON transactions(parent_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_parent ON transaction_splits(transaction_id);

-- 5. DISABLE RLS ON BANK ACCOUNTS
ALTER TABLE bank_accounts DISABLE ROW LEVEL SECURITY;

-- 6. INSERT DEFAULT BANK ACCOUNT FOR EXISTING ACCOUNTSl
-- This creates a default "Main Account" for each existing account
INSERT INTO bank_accounts (account_id, account_name, account_type, is_default, active)
SELECT DISTINCT id, 'Main Account', 'Current', true, true
FROM accounts
WHERE NOT EXISTS (
  SELECT 1 FROM bank_accounts WHERE bank_accounts.account_id = accounts.id
);

-- 7. VERIFY SETUP
SELECT 
  'Bank accounts feature ready!' as status,
  (SELECT COUNT(*) FROM bank_accounts) as bank_accounts_count,
  (SELECT COUNT(*) FROM transaction_splits) as splits_count;

-- ═══════════════════════════════════════════════════════════
-- NOTES:
-- ═══════════════════════════════════════════════════════════
-- • bank_accounts: Stores user's bank accounts
-- • transactions.bank_account_id: Links transaction to a bank account
-- • transactions.parent_transaction_id: Links split transactions to parent
-- • transactions.is_split: Marks if transaction has been split
-- • transaction_splits: Stores how a transaction is split across cars
-- 
-- USAGE:
-- 1. Users can add multiple bank accounts
-- 2. When logging a transaction, select which bank account it came from
-- 3. When splitting a transaction, create entries in transaction_splits
-- 4. Parent transaction is marked with is_split=true
-- 5. Display splits inline on transactions page
-- ═══════════════════════════════════════════════════════════
