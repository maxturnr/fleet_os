-- Fix settings table to support upsert with account_id and key
-- Run this in Supabase SQL Editor

-- 1. Add unique constraint on account_id + key combination
ALTER TABLE settings 
DROP CONSTRAINT IF EXISTS settings_account_id_key_unique;

ALTER TABLE settings 
ADD CONSTRAINT settings_account_id_key_unique UNIQUE (account_id, key);

-- 2. Verify the constraint exists
SELECT 
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'settings'::regclass
  AND conname = 'settings_account_id_key_unique';

-- Should show: settings_account_id_key_unique | u
