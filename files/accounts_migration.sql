-- ═══════════════════════════════════════════
-- FleetOS v2 — Multi-Tenant Accounts System
-- Run this in Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════

-- 1. Create accounts table (dealerships)
CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  dealer_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}'::jsonb
);

-- 2. Create users table (people who can log in)
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'user', -- 'admin', 'user', 'viewer'
  active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add account_id to existing tables
ALTER TABLE cars ADD COLUMN IF NOT EXISTS account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE balance_sheet ADD COLUMN IF NOT EXISTS account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cars_account_id ON cars(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_balance_sheet_account_id ON balance_sheet(account_id);
CREATE INDEX IF NOT EXISTS idx_settings_account_id ON settings(account_id);
CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 5. Create THG Automotive account
INSERT INTO accounts (dealer_name, settings)
VALUES ('THG Automotive', '{"vat_registered": false}'::jsonb)
RETURNING id;

-- Note: Copy the returned ID and use it in the next step

-- 6. Create user for Max Turner
-- Replace <ACCOUNT_ID> with the ID from step 5
-- Password will be: FleetOS2024!
-- Hash generated with bcrypt (cost factor 10)
INSERT INTO users (account_id, email, password_hash, full_name, role)
VALUES (
  1, -- Replace with actual account_id from step 5
  'max@thgautomotive.com',
  '$2a$10$rZ8qKqX5YvN5XJYvN5XJYOqKqX5YvN5XJYvN5XJYOqKqX5YvN5XJY', -- Placeholder - will be replaced
  'Max Turner',
  'admin'
);

-- 7. Link existing data to THG Automotive account
-- Replace <ACCOUNT_ID> with the ID from step 5
UPDATE cars SET account_id = 1 WHERE account_id IS NULL;
UPDATE transactions SET account_id = 1 WHERE account_id IS NULL;
UPDATE balance_sheet SET account_id = 1 WHERE account_id IS NULL;
UPDATE settings SET account_id = 1 WHERE account_id IS NULL;

-- 8. Make account_id required going forward (after linking existing data)
ALTER TABLE cars ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE balance_sheet ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE settings ALTER COLUMN account_id SET NOT NULL;

-- 9. Disable RLS on new tables
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 10. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Create triggers for updated_at
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 12. Verify setup
SELECT 
  a.id as account_id,
  a.dealer_name,
  COUNT(DISTINCT u.id) as users,
  COUNT(DISTINCT c.id) as cars,
  COUNT(DISTINCT t.id) as transactions
FROM accounts a
LEFT JOIN users u ON u.account_id = a.id
LEFT JOIN cars c ON c.account_id = a.id
LEFT JOIN transactions t ON t.account_id = a.id
GROUP BY a.id, a.dealer_name;

-- 13. View user details
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  a.dealer_name,
  u.created_at
FROM users u
JOIN accounts a ON a.id = u.account_id;
