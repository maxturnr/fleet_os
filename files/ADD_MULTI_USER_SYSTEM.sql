-- ═══════════════════════════════════════════════════════════
-- MULTI-USER SYSTEM WITH ROLE-BASED ACCESS CONTROL
-- Run this in Supabase SQL Editor to add multi-user support
-- ═══════════════════════════════════════════════════════════

-- 1. ADD USER PROFILE FIELDS TO ACCOUNTS TABLE
-- This extends the existing accounts table to support user profiles
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Update existing accounts to have admin role
UPDATE accounts SET role = 'admin' WHERE role IS NULL OR role = 'user';

-- 2. CREATE DEALERSHIP_USERS TABLE
-- This links multiple users to a single dealership
CREATE TABLE IF NOT EXISTS dealership_users (
  id BIGSERIAL PRIMARY KEY,
  dealership_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user', -- 'admin', 'user', 'viewer'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(dealership_id, user_account_id)
);

-- 3. ADD AUDIT COLUMNS TO TRACK WHO CREATED/MODIFIED RECORDS
-- Add created_by and added_by columns to track user attribution

-- Cars table
ALTER TABLE cars ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS created_by_name TEXT;

-- Transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES auth.users(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;

-- Mileage trips table
ALTER TABLE mileage_trips ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id);
ALTER TABLE mileage_trips ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE mileage_trips ADD COLUMN IF NOT EXISTS driver_user_id UUID REFERENCES auth.users(id);
ALTER TABLE mileage_trips ADD COLUMN IF NOT EXISTS driver_name TEXT;

-- Bank accounts table
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id);
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS created_by_name TEXT;

-- 4. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_dealership_users_dealership_id ON dealership_users(dealership_id);
CREATE INDEX IF NOT EXISTS idx_dealership_users_user_account_id ON dealership_users(user_account_id);
CREATE INDEX IF NOT EXISTS idx_cars_created_by ON cars(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_assigned_to ON transactions(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_created_by ON mileage_trips(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_driver ON mileage_trips(driver_user_id);

-- 5. DISABLE RLS ON NEW TABLE
ALTER TABLE dealership_users DISABLE ROW LEVEL SECURITY;

-- 6. CREATE FUNCTION TO GET DEALERSHIP USERS
CREATE OR REPLACE FUNCTION get_dealership_users(p_dealership_id BIGINT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  active BOOLEAN,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Get the dealership owner (primary account)
  SELECT 
    a.user_id,
    COALESCE(au.email::TEXT, a.primary_email) as email,
    a.full_name,
    COALESCE(a.role, 'admin') as role,
    COALESCE(a.active, true) as active,
    a.last_login,
    a.created_at
  FROM accounts a
  LEFT JOIN auth.users au ON au.id = a.user_id
  WHERE a.id = p_dealership_id
  
  UNION
  
  -- Get all linked users from dealership_users table
  SELECT 
    a.user_id,
    COALESCE(au.email::TEXT, a.primary_email) as email,
    a.full_name,
    COALESCE(du.role, 'user') as role,
    COALESCE(a.active, true) as active,
    a.last_login,
    a.created_at
  FROM dealership_users du
  JOIN accounts a ON a.id = du.user_account_id
  LEFT JOIN auth.users au ON au.id = a.user_id
  WHERE du.dealership_id = p_dealership_id
    AND a.id != p_dealership_id  -- Avoid duplicates
  
  ORDER BY role DESC, full_name;
END;
$$ LANGUAGE plpgsql;

-- 7. CREATE FUNCTION TO CHECK IF USER IS ADMIN
CREATE OR REPLACE FUNCTION is_user_admin(p_user_id UUID, p_dealership_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT du.role INTO user_role
  FROM dealership_users du
  JOIN accounts a ON a.id = du.user_account_id
  WHERE a.user_id = p_user_id
    AND du.dealership_id = p_dealership_id;
  
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql;

-- 8. MIGRATE EXISTING DATA
-- Link existing accounts to themselves as the primary dealership
INSERT INTO dealership_users (dealership_id, user_account_id, role)
SELECT id, id, 'admin'
FROM accounts
WHERE user_id IS NOT NULL
ON CONFLICT (dealership_id, user_account_id) DO NOTHING;

-- 9. CREATE VIEW FOR USER ACTIVITY
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
  a.user_id,
  a.full_name,
  a.primary_email as email,
  du.dealership_id,
  d.dealer_name,
  du.role,
  COUNT(DISTINCT t.id) as transactions_created,
  COUNT(DISTINCT m.id) as mileage_trips_created,
  COUNT(DISTINCT c.id) as cars_created,
  MAX(a.last_login) as last_login
FROM accounts a
JOIN dealership_users du ON du.user_account_id = a.id
JOIN accounts d ON d.id = du.dealership_id
LEFT JOIN transactions t ON t.created_by_user_id = a.user_id
LEFT JOIN mileage_trips m ON m.created_by_user_id = a.user_id
LEFT JOIN cars c ON c.created_by_user_id = a.user_id
GROUP BY a.user_id, a.full_name, a.primary_email, du.dealership_id, d.dealer_name, du.role;

-- 10. VERIFY SETUP
SELECT 
  'Multi-User System Setup Complete!' as status,
  (SELECT COUNT(*) FROM dealership_users) as total_user_links,
  (SELECT COUNT(DISTINCT dealership_id) FROM dealership_users) as dealerships_with_users,
  (SELECT COUNT(DISTINCT user_account_id) FROM dealership_users) as total_users;

-- 11. SHOW CURRENT DEALERSHIP STRUCTURE
SELECT 
  d.dealer_name,
  COUNT(DISTINCT du.user_account_id) as user_count,
  STRING_AGG(DISTINCT du.role, ', ') as roles
FROM accounts d
LEFT JOIN dealership_users du ON du.dealership_id = d.id
GROUP BY d.id, d.dealer_name
ORDER BY d.dealer_name;

-- 12. GRANT PERMISSIONS ON FUNCTIONS
GRANT EXECUTE ON FUNCTION get_dealership_users(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dealership_users(BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION is_user_admin(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin(UUID, BIGINT) TO anon;
