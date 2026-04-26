-- Clear old QuickBooks credentials so you can reconnect properly
-- Run this in Supabase SQL Editor

DELETE FROM settings 
WHERE key IN ('qb_connected', 'qb_realm_id', 'qb_access_token', 'qb_refresh_token', 'qb_auth_code');

-- Verify they're cleared
SELECT * FROM settings WHERE key LIKE 'qb_%';
