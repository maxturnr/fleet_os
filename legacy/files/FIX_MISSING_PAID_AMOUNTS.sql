-- ============================================
-- FIX MISSING PAID AMOUNTS FROM VEHICLE PURCHASE
-- ============================================
-- Run this to populate the 'paid' field for cars that have
-- Vehicle Purchase transactions but missing paid amounts

-- STEP 1: See which cars will be updated
SELECT 
  c.id,
  c.stock_number,
  c.reg,
  c.paid as current_paid,
  t.amount as vehicle_purchase_amount,
  t.date as purchase_date,
  t.supplier
FROM cars c
JOIN transactions t ON t.stock_id = c.id
WHERE t.type = 'Vehicle Purchase'
  AND c.type = 'owned'
  AND (c.paid IS NULL OR c.paid = 0)
ORDER BY c.stock_number;

-- STEP 2: Update the paid amounts
-- This will set the paid field to the Vehicle Purchase transaction amount
UPDATE cars c
SET 
  paid = t.amount,
  purchase_date = COALESCE(c.purchase_date, t.date)
FROM transactions t
WHERE t.stock_id = c.id
  AND t.type = 'Vehicle Purchase'
  AND c.type = 'owned'
  AND (c.paid IS NULL OR c.paid = 0);

-- STEP 3: Verify the fix
SELECT 
  c.id,
  c.stock_number,
  c.reg,
  c.paid,
  c.purchase_date,
  t.amount as vehicle_purchase_amount
FROM cars c
JOIN transactions t ON t.stock_id = c.id
WHERE t.type = 'Vehicle Purchase'
  AND c.type = 'owned'
ORDER BY c.stock_number;
