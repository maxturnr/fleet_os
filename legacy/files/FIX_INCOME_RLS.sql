-- ============================================
-- FIX INCOME / BANK MOVEMENT RLS ERRORS
-- Run this in Supabase SQL Editor
-- ============================================

-- The app currently uses the anon key in the browser and expects
-- these operational tables to be writable without custom RLS policies.
-- If RLS is enabled without matching policies, inserts will fail with:
-- "new row violates row-level security policy"

ALTER TABLE IF EXISTS income DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bank_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS income_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expense_types DISABLE ROW LEVEL SECURITY;

SELECT
  'income' AS table_name,
  relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname = 'income'

UNION ALL

SELECT
  'bank_movements' AS table_name,
  relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname = 'bank_movements'

UNION ALL

SELECT
  'income_types' AS table_name,
  relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname = 'income_types'

UNION ALL

SELECT
  'expense_types' AS table_name,
  relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname = 'expense_types';
