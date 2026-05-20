-- ============================================
-- REPOPULATE MISSING TRANSACTIONS FROM QUICKBOOKS
-- ============================================
-- This script helps diagnose and fix missing QuickBooks transactions

-- 1. CHECK CURRENT TRANSACTION COUNT
SELECT 
  source,
  COUNT(*) as transaction_count,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM transactions
GROUP BY source;

-- 2. CHECK FOR DUPLICATE QUICKBOOKS TRANSACTIONS
-- (In case they were imported multiple times)
SELECT 
  date,
  supplier,
  amount,
  COUNT(*) as duplicate_count
FROM transactions
WHERE source = 'quickbooks'
GROUP BY date, supplier, amount
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 3. CHECK UNASSIGNED QUICKBOOKS TRANSACTIONS
SELECT 
  id,
  date,
  supplier,
  type,
  amount,
  assigned
FROM transactions
WHERE source = 'quickbooks' AND assigned = false
ORDER BY date DESC
LIMIT 50;

-- 4. CHECK VEHICLE PURCHASE TRANSACTIONS
SELECT 
  id,
  date,
  supplier,
  amount,
  stock_id,
  car_reg,
  assigned
FROM transactions
WHERE type = 'Vehicle Purchase'
ORDER BY date DESC;

-- 5. UPDATE VEHICLE PURCHASE TRANSACTIONS TO POPULATE PAID COLUMN
-- This query finds Vehicle Purchase transactions and updates the corresponding car's paid amount
-- Run this if you have Vehicle Purchase transactions that should populate the 'paid' field

-- First, check what would be updated:
SELECT 
  c.id as car_id,
  c.reg,
  c.stock_number,
  c.paid as current_paid,
  t.amount as transaction_amount,
  t.id as transaction_id,
  t.date as purchase_date
FROM cars c
JOIN transactions t ON t.stock_id = c.id
WHERE t.type = 'Vehicle Purchase'
  AND c.type = 'owned'
  AND (c.paid IS NULL OR c.paid = 0 OR c.paid != t.amount);

-- To actually update the paid amounts (UNCOMMENT TO RUN):
/*
UPDATE cars c
SET paid = t.amount,
    purchase_date = COALESCE(c.purchase_date, t.date)
FROM transactions t
WHERE t.stock_id = c.id
  AND t.type = 'Vehicle Purchase'
  AND c.type = 'owned'
  AND (c.paid IS NULL OR c.paid = 0 OR c.paid != t.amount);
*/

-- 6. CHECK FOR TRANSACTIONS THAT MIGHT BE MISSING STOCK ASSIGNMENTS
SELECT 
  t.id,
  t.date,
  t.supplier,
  t.type,
  t.amount,
  t.car_reg,
  t.stock_id,
  c.id as actual_car_id,
  c.stock_number
FROM transactions t
LEFT JOIN cars c ON c.reg = t.car_reg
WHERE t.source = 'quickbooks'
  AND t.car_reg IS NOT NULL
  AND t.stock_id IS NULL
  AND c.id IS NOT NULL
ORDER BY t.date DESC;

-- To fix missing stock_id assignments (UNCOMMENT TO RUN):
/*
UPDATE transactions t
SET stock_id = c.id,
    assigned = true
FROM cars c
WHERE c.reg = t.car_reg
  AND t.source = 'quickbooks'
  AND t.car_reg IS NOT NULL
  AND t.stock_id IS NULL;
*/

-- 7. VERIFY TRANSACTION TOTALS BY TYPE
SELECT 
  type,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount
FROM transactions
GROUP BY type
ORDER BY total_amount DESC;

-- 8. CHECK FOR ORPHANED TRANSACTION SPLITS
SELECT 
  ts.id,
  ts.transaction_id,
  ts.car_id,
  ts.amount,
  t.id as tx_exists,
  c.id as car_exists
FROM transaction_splits ts
LEFT JOIN transactions t ON t.id = ts.transaction_id
LEFT JOIN cars c ON c.id = ts.car_id
WHERE t.id IS NULL OR c.id IS NULL;

-- 9. CLEAN UP ORPHANED SPLITS (UNCOMMENT TO RUN):
/*
DELETE FROM transaction_splits
WHERE transaction_id NOT IN (SELECT id FROM transactions)
   OR car_id NOT IN (SELECT id FROM cars);
*/

-- ============================================
-- NOTES FOR REPOPULATION:
-- ============================================
-- If you need to re-import from QuickBooks:
-- 1. Make sure QB_CONNECTED is set to true in settings
-- 2. Check that your QuickBooks OAuth token is still valid
-- 3. The app will automatically fetch new transactions on load
-- 4. Unassigned QB transactions will show in the alert bar

-- To manually trigger a QuickBooks sync:
-- 1. Go to the app
-- 2. Click the QuickBooks badge in the top right
-- 3. Re-authenticate if needed
-- 4. Transactions should sync automatically

-- ============================================
-- BACKUP BEFORE RUNNING UPDATES:
-- ============================================
-- Always backup your data before running UPDATE or DELETE queries!
-- 
-- To backup transactions:
-- CREATE TABLE transactions_backup AS SELECT * FROM transactions;
-- 
-- To restore from backup:
-- DELETE FROM transactions;
-- INSERT INTO transactions SELECT * FROM transactions_backup;
