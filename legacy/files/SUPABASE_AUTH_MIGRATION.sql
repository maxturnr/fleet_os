-- ═══════════════════════════════════════════
-- MIGRATE TO SUPABASE AUTH
-- ═══════════════════════════════════════════

-- Step 1: Drop the custom users table (we'll use Supabase Auth instead)
DROP TABLE IF EXISTS users;

-- Step 2: Add user_id to accounts table to link to Supabase Auth
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 3: Add metadata columns to accounts for user info
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS primary_email TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS primary_user_name TEXT;

-- Step 4: Create index
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- Step 5: Update THG Automotive account with user info (will link after user is created in Auth)
UPDATE accounts 
SET primary_email = 'max@thgautomotive.com',
    primary_user_name = 'Max Turner'
WHERE dealer_name = 'THG Automotive';

-- Step 6: Verify
SELECT 
  id,
  dealer_name,
  primary_email,
  primary_user_name,
  user_id,
  active
FROM accounts;
