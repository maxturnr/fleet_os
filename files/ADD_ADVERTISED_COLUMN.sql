-- Add advertised column to cars table
-- Run this in Supabase SQL Editor

-- Add the column if it doesn't exist
ALTER TABLE cars 
ADD COLUMN IF NOT EXISTS advertised NUMERIC(10,2);

-- Verify the column was added
SELECT id, stock_number, reg, paid, advertised, sold 
FROM cars 
WHERE type = 'owned'
ORDER BY stock_number;
