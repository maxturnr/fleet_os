-- ============================================
-- UPDATE PAID AMOUNTS FROM VEHICLE PURCHASE TRANSACTIONS
-- ============================================
-- This script updates the 'paid' column in the cars table
-- based on Vehicle Purchase transactions that are assigned to each car

-- STEP 1: Preview what will be updated
SELECT 
  c.id as car_id,
  c.stock_number,
  c.reg,
  c.paid as current_paid_amount,
  t.amount as vehicle_purchase_amount,
  t.date as purchase_date,
  t.supplier as purchased_from,
  CASE 
    WHEN c.paid IS NULL OR c.paid = 0 THEN 'Will be set'
    WHEN c.paid != t.amount THEN 'Will be updated'
    ELSE 'Already correct'
  END as action
FROM cars c
JOIN transactions t ON t.stock_id = c.id
WHERE t.type = 'Vehicle Purchase'
  AND c.type = 'owned'
ORDER BY c.stock_number;

-- STEP 2: Run this to actually update the paid amounts
-- IMPORTANT: Review the preview above first!

UPDATE cars c
SET 
  paid = t.amount,
  purchase_date = COALESCE(c.purchase_date, t.date)
FROM transactions t
WHERE t.stock_id = c.id
  AND t.type = 'Vehicle Purchase'
  AND c.type = 'owned';

-- STEP 3: Verify the updates
SELECT 
  c.id,
  c.stock_number,
  c.reg,
  c.paid,
  c.purchase_date,
  t.amount as vehicle_purchase_amount,
  t.date as transaction_date
FROM cars c
JOIN transactions t ON t.stock_id = c.id
WHERE t.type = 'Vehicle Purchase'
  AND c.type = 'owned'
ORDER BY c.stock_number;

-- STEP 4: Check for cars that might have multiple Vehicle Purchase transactions
-- (This could indicate a problem)
SELECT 
  c.id,
  c.stock_number,
  c.reg,
  COUNT(t.id) as vehicle_purchase_count,
  SUM(t.amount) as total_purchase_amount
FROM cars c
JOIN transactions t ON t.stock_id = c.id
WHERE t.type = 'Vehicle Purchase'
  AND c.type = 'owned'
GROUP BY c.id, c.stock_number, c.reg
HAVING COUNT(t.id) > 1;
