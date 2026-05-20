-- Disable RLS on the operational income tables to match the rest of the app.
-- The browser app writes directly with the anon key and does not define
-- per-table insert/update policies for these tables yet.

ALTER TABLE IF EXISTS income DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bank_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS income_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expense_types DISABLE ROW LEVEL SECURITY;
