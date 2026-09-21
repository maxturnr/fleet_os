-- ═══════════════════════════════════════════
-- CHECK EXISTING SETUP AND FIX IF NEEDED
-- ═══════════════════════════════════════════

-- Step 1: Check what exists
SELECT 
  a.id as account_id,
  a.dealer_name,
  u.id as user_id,
  u.email,
  u.full_name,
  u.role
FROM accounts a
LEFT JOIN users u ON u.account_id = a.id
ORDER BY a.id;

-- Step 2: Check if data is linked to accounts
SELECT 
  'cars' as table_name,
  COUNT(*) as total,
  COUNT(account_id) as with_account,
  COUNT(*) - COUNT(account_id) as without_account
FROM cars
UNION ALL
SELECT 
  'transactions',
  COUNT(*),
  COUNT(account_id),
  COUNT(*) - COUNT(account_id)
FROM transactions
UNION ALL
SELECT 
  'balance_sheet',
  COUNT(*),
  COUNT(account_id),
  COUNT(*) - COUNT(account_id)
FROM balance_sheet
UNION ALL
SELECT 
  'settings',
  COUNT(*),
  COUNT(account_id),
  COUNT(*) - COUNT(account_id)
FROM settings;

-- Step 3: If account exists but data isn't linked, run this:
-- (Only run if Step 2 shows data without_account > 0)

-- Find the account_id for THG Automotive
SELECT id FROM accounts WHERE dealer_name = 'THG Automotive';

-- Link all existing data to THG Automotive (replace 1 with actual account_id if different)
UPDATE cars SET account_id = 1 WHERE account_id IS NULL;
UPDATE transactions SET account_id = 1 WHERE account_id IS NULL;
UPDATE balance_sheet SET account_id = 1 WHERE account_id IS NULL;
UPDATE settings SET account_id = 1 WHERE account_id IS NULL;

-- Step 4: Verify final setup
SELECT 
  a.id as account_id,
  a.dealer_name,
  u.email,
  u.full_name,
  u.role,
  COUNT(DISTINCT c.id) as total_cars,
  COUNT(DISTINCT t.id) as total_transactions,
  COUNT(DISTINCT b.id) as balance_sheets,
  COUNT(DISTINCT s.id) as settings
FROM accounts a
JOIN users u ON u.account_id = a.id
LEFT JOIN cars c ON c.account_id = a.id
LEFT JOIN transactions t ON t.account_id = a.id
LEFT JOIN balance_sheet b ON b.account_id = a.id
LEFT JOIN settings s ON s.account_id = a.id
WHERE a.dealer_name = 'THG Automotive'
GROUP BY a.id, a.dealer_name, u.email, u.full_name, u.role;
