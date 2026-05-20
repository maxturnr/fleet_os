-- ============================================
-- RUN THIS IN SUPABASE SQL EDITOR NOW
-- ============================================
-- This will fix the 2 cars with missing paid amounts

UPDATE cars c
SET 
  paid = t.amount,
  purchase_date = COALESCE(c.purchase_date, t.date)
FROM transactions t
WHERE t.stock_id = c.id
  AND t.type = 'Vehicle Purchase'
  AND c.type = 'owned'
  AND (c.paid IS NULL OR c.paid = 0);

-- After running this, refresh your FleetOS app and the paid amounts should appear
