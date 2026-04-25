-- ═══════════════════════════════════════════
-- CHECK CURRENT DATABASE STATE
-- Run this to see what tables exist
-- ═══════════════════════════════════════════

-- List all tables in public schema
SELECT 
  table_name,
  CASE 
    WHEN table_name = 'accounts' THEN '✅ NEEDED FOR LOGIN'
    WHEN table_name = 'cars' THEN '✅ NEEDED'
    WHEN table_name = 'transactions' THEN '✅ NEEDED'
    WHEN table_name = 'balance_sheet' THEN '✅ NEEDED'
    WHEN table_name = 'settings' THEN '✅ NEEDED'
    WHEN table_name = 'users' THEN '⚠️ OLD TABLE - Will be removed'
    ELSE '📋 Other'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check if accounts table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'accounts'
    ) THEN '✅ accounts table EXISTS'
    ELSE '❌ accounts table MISSING - This is causing your 404 error!'
  END as accounts_status;

-- If accounts exists, show its structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'accounts'
ORDER BY ordinal_position;

-- Check if other required tables exist
SELECT 
  'cars' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cars') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT 
  'transactions',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'balance_sheet',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'balance_sheet') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'settings',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END;
