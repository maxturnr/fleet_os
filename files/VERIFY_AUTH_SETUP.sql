-- ═══════════════════════════════════════════
-- VERIFY AUTHENTICATION SETUP
-- Run this to check if everything is configured correctly
-- ═══════════════════════════════════════════

-- 1. Check if accounts table has user_id column
SELECT 
  'accounts.user_id column' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'accounts' AND column_name = 'user_id'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING - Run SUPABASE_AUTH_MIGRATION.sql'
  END as status;

-- 2. Check if THG Automotive account exists
SELECT 
  'THG Automotive account' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM accounts WHERE dealer_name = 'THG Automotive')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING - Run accounts_migration.sql first'
  END as status;

-- 3. Check if THG Automotive has a linked user_id
SELECT 
  'THG Automotive user_id link' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM accounts 
      WHERE dealer_name = 'THG Automotive' 
        AND user_id IS NOT NULL
    ) THEN '✅ LINKED'
    ELSE '❌ NOT LINKED - Need to update user_id'
  END as status;

-- 4. Check if auth user exists
SELECT 
  'Supabase Auth user' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'max@thgautomotive.com')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING - Create user in Supabase Auth UI'
  END as status;

-- 5. Check if auth user is confirmed
SELECT 
  'Auth user confirmed' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM auth.users 
      WHERE email = 'max@thgautomotive.com' 
        AND email_confirmed_at IS NOT NULL
    ) THEN '✅ CONFIRMED'
    WHEN EXISTS (
      SELECT 1 FROM auth.users 
      WHERE email = 'max@thgautomotive.com'
    ) THEN '⚠️ NOT CONFIRMED - Confirm in Supabase Auth UI'
    ELSE '❌ USER DOES NOT EXIST'
  END as status;

-- 6. Check if user_id matches between accounts and auth.users
SELECT 
  'user_id match' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM accounts a
      JOIN auth.users au ON au.id = a.user_id
      WHERE a.dealer_name = 'THG Automotive'
        AND au.email = 'max@thgautomotive.com'
    ) THEN '✅ MATCHED'
    ELSE '❌ MISMATCH - Run COMPLETE_AUTH_SETUP.sql'
  END as status;

-- 7. Check if account is active
SELECT 
  'Account active status' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM accounts 
      WHERE dealer_name = 'THG Automotive' 
        AND active = true
    ) THEN '✅ ACTIVE'
    ELSE '❌ INACTIVE - Set active = true'
  END as status;

-- ═══════════════════════════════════════════
-- DETAILED INFORMATION
-- ═══════════════════════════════════════════

-- Show account details
SELECT 
  '--- ACCOUNT DETAILS ---' as section,
  '' as id,
  '' as dealer_name,
  '' as user_id,
  '' as auth_email,
  '' as active
UNION ALL
SELECT 
  '',
  a.id::text,
  a.dealer_name,
  COALESCE(a.user_id::text, 'NULL'),
  COALESCE(au.email, 'NO AUTH USER'),
  a.active::text
FROM accounts a
LEFT JOIN auth.users au ON au.id = a.user_id
WHERE a.dealer_name = 'THG Automotive';

-- Show auth user details
SELECT 
  '--- AUTH USER DETAILS ---' as section,
  '' as id,
  '' as email,
  '' as confirmed,
  '' as last_sign_in
UNION ALL
SELECT 
  '',
  id::text,
  email,
  CASE WHEN email_confirmed_at IS NOT NULL THEN 'YES' ELSE 'NO' END,
  COALESCE(last_sign_in_at::text, 'NEVER')
FROM auth.users
WHERE email = 'max@thgautomotive.com';

-- Show data counts
SELECT 
  '--- DATA COUNTS ---' as section,
  '' as table_name,
  '' as count
UNION ALL
SELECT 
  '',
  'cars',
  COUNT(*)::text
FROM cars
WHERE account_id = (SELECT id FROM accounts WHERE dealer_name = 'THG Automotive')
UNION ALL
SELECT 
  '',
  'transactions',
  COUNT(*)::text
FROM transactions
WHERE account_id = (SELECT id FROM accounts WHERE dealer_name = 'THG Automotive')
UNION ALL
SELECT 
  '',
  'balance_sheet',
  COUNT(*)::text
FROM balance_sheet
WHERE account_id = (SELECT id FROM accounts WHERE dealer_name = 'THG Automotive')
UNION ALL
SELECT 
  '',
  'settings',
  COUNT(*)::text
FROM settings
WHERE account_id = (SELECT id FROM accounts WHERE dealer_name = 'THG Automotive');

-- ═══════════════════════════════════════════
-- QUICK FIX COMMANDS (if needed)
-- ═══════════════════════════════════════════

-- Uncomment and run these if you need to fix issues:

-- Fix 1: Link auth user to account (replace UUID)
-- UPDATE accounts 
-- SET user_id = 'YOUR-AUTH-USER-UUID-HERE'::uuid
-- WHERE dealer_name = 'THG Automotive';

-- Fix 2: Activate account
-- UPDATE accounts 
-- SET active = true
-- WHERE dealer_name = 'THG Automotive';

-- Fix 3: Link existing data to account
-- UPDATE cars SET account_id = (SELECT id FROM accounts WHERE dealer_name = 'THG Automotive') WHERE account_id IS NULL;
-- UPDATE transactions SET account_id = (SELECT id FROM accounts WHERE dealer_name = 'THG Automotive') WHERE account_id IS NULL;
-- UPDATE balance_sheet SET account_id = (SELECT id FROM accounts WHERE dealer_name = 'THG Automotive') WHERE account_id IS NULL;
-- UPDATE settings SET account_id = (SELECT id FROM accounts WHERE dealer_name = 'THG Automotive') WHERE account_id IS NULL;
