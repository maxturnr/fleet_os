-- ═══════════════════════════════════════════
-- COMPLETE SUPABASE AUTH SETUP
-- Run this AFTER creating a user in Supabase Auth UI
-- ═══════════════════════════════════════════

-- Step 1: Verify the auth user exists
-- Go to Supabase Dashboard → Authentication → Users
-- Click "Add User" and create user with:
--   Email: max@thgautomotive.com
--   Password: (your secure password)
--   Auto Confirm: YES
-- Copy the user's UUID from the dashboard

-- Step 2: Link the auth user to the account
-- Replace 'YOUR-USER-UUID-HERE' with the actual UUID from Supabase Auth
UPDATE accounts 
SET user_id = 'YOUR-USER-UUID-HERE'::uuid
WHERE dealer_name = 'THG Automotive';

-- Step 3: Verify the link
SELECT 
  a.id as account_id,
  a.dealer_name,
  a.user_id,
  a.primary_email,
  a.primary_user_name,
  a.active,
  au.email as auth_email,
  au.created_at as auth_created_at
FROM accounts a
LEFT JOIN auth.users au ON au.id = a.user_id
WHERE a.dealer_name = 'THG Automotive';

-- Step 4: Test query (this is what the app runs on login)
-- Replace 'YOUR-USER-UUID-HERE' with the actual UUID
SELECT *
FROM accounts
WHERE user_id = 'YOUR-USER-UUID-HERE'::uuid
  AND active = true;

-- ═══════════════════════════════════════════
-- ALTERNATIVE: If you want to find existing auth users
-- ═══════════════════════════════════════════

-- List all auth users
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- ═══════════════════════════════════════════
-- TROUBLESHOOTING
-- ═══════════════════════════════════════════

-- Check if user_id column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts' 
  AND column_name = 'user_id';

-- Check accounts without linked users
SELECT 
  id,
  dealer_name,
  user_id,
  primary_email,
  active
FROM accounts
WHERE user_id IS NULL;

-- Check for orphaned user_id references
SELECT 
  a.id,
  a.dealer_name,
  a.user_id,
  CASE 
    WHEN au.id IS NULL THEN 'ORPHANED - User does not exist in auth.users'
    ELSE 'OK'
  END as status
FROM accounts a
LEFT JOIN auth.users au ON au.id = a.user_id
WHERE a.user_id IS NOT NULL;
