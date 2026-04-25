-- ═══════════════════════════════════════════
-- ONE-TIME SETUP FOR THG AUTOMOTIVE
-- Run this ONCE in Supabase SQL Editor
-- ═══════════════════════════════════════════

-- Step 1: Create THG Automotive account
INSERT INTO accounts (dealer_name, settings)
VALUES ('THG Automotive', '{"vat_registered": false}'::jsonb)
RETURNING id;

-- Step 2: Create Max Turner user (account_id = 1)
-- Email: max@thgautomotive.com
-- Password: KreFSSn8!@SSxdV%
INSERT INTO users (account_id, email, password_hash, full_name, role)
VALUES (
  1,
  'max@thgautomotive.com',
  'd74d5f8d1ddf6bec20be0281853c1758d5cd1a6a367034bf8d42f196ed08d545',
  'Max Turner',
  'admin'
);

-- Step 3: Link all existing data to THG Automotive (account_id = 1)
UPDATE cars SET account_id = 1 WHERE account_id IS NULL;
UPDATE transactions SET account_id = 1 WHERE account_id IS NULL;
UPDATE balance_sheet SET account_id = 1 WHERE account_id IS NULL;
UPDATE settings SET account_id = 1 WHERE account_id IS NULL;

-- Step 4: Verify setup
SELECT 
  a.id as account_id,
  a.dealer_name,
  u.email,
  u.full_name,
  u.role,
  COUNT(DISTINCT c.id) as total_cars,
  COUNT(DISTINCT t.id) as total_transactions
FROM accounts a
JOIN users u ON u.account_id = a.id
LEFT JOIN cars c ON c.account_id = a.id
LEFT JOIN transactions t ON t.account_id = a.id
WHERE a.id = 1
GROUP BY a.id, a.dealer_name, u.email, u.full_name, u.role;
