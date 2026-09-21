-- Add current_balance column to bank_accounts table
-- Run this in Supabase SQL Editor

-- Add the column if it doesn't exist
ALTER TABLE bank_accounts 
ADD COLUMN IF NOT EXISTS current_balance NUMERIC(10,2) DEFAULT 0;

-- Update existing accounts to have a balance of 0
UPDATE bank_accounts 
SET current_balance = 0 
WHERE current_balance IS NULL;

-- Verify the column was added
SELECT id, account_name, current_balance 
FROM bank_accounts 
ORDER BY account_name;
