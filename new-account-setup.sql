-- =====================================================================
-- Fleet: create a second account and copy all 36 vehicles into it
-- Project: fleet os (hnypmigzwfavwcwarmnk)
--
-- This gives you a clean account with your stock but no transactions,
-- so you can rebuild the ledger from the bank.
--
-- Nothing here touches account 1. Your existing data is read only.
-- =====================================================================


-- ---------------------------------------------------------------------
-- BEFORE YOU RUN THIS — create the login. I can't do this part.
--
-- 1. Supabase Dashboard -> Authentication -> Users -> "Add user"
-- 2. Use a different email from max@thgautomotive.com.
--    A plus-address works and still reaches your inbox:
--       max+clean@thgautomotive.com
-- 3. Set a password and tick "Auto Confirm User"
-- 4. Copy the new user's UUID from the users list
-- 5. Paste it into :new_user_id below
--
-- Why a separate login: fleet resolves your account with
--   .eq('user_id', ...).eq('active', true).single()
-- Two active accounts on one user id makes .single() throw, and you'd be
-- locked out of BOTH accounts. A separate login avoids that entirely.
-- ---------------------------------------------------------------------


-- =====================================================================
-- STEP 1 — safety net
-- =====================================================================
create table if not exists backup_cars_20260810 as select * from cars;
create table if not exists backup_accounts_20260810 as select * from accounts;

-- Confirm the source before copying. Expect: 36 cars, 26 sold, 10 in stock.
select count(*) as total_cars,
       count(*) filter (where status ilike '%sold%')      as sold,
       count(*) filter (where status not ilike '%sold%'
                          or status is null)              as in_stock,
       count(*) filter (where is_sale_or_return)          as sale_or_return
from cars where account_id = 1;


-- =====================================================================
-- STEP 2 — create the account
-- Replace the UUID below with the one from the dashboard.
-- =====================================================================
begin;

insert into accounts (dealer_name, primary_email, primary_user_name, full_name,
                      user_id, role, active, settings)
values ('THG Automotive (clean)',
        'max+clean@thgautomotive.com',
        'Max Turner',
        'Max Turner',
        '00000000-0000-0000-0000-000000000000'::uuid,   -- <<< PASTE THE NEW USER UUID
        'admin',
        true,
        (select settings from accounts where id = 1))
returning id as new_account_id;

-- Note the id it prints. Everything below assumes it is 2 — change if not.

commit;


-- =====================================================================
-- STEP 3 — copy all 36 vehicles
--
-- cars.id is GENERATED ALWAYS, so ids are not copied; the new rows get
-- fresh ones. That's correct: they're separate records in a separate
-- account, and nothing in the old account points at them.
-- =====================================================================
begin;

insert into cars (
  account_id,
  reg, make, model, paid, sold, purchase_date, sale_date, status, notes,
  created_at, type, stock_number, owner_name, min_price, sale_price,
  received_date, fee, fee_vat, advertised, created_by_user_id, created_by_name,
  registration, stock_number_text, is_sale_or_return, sale_or_return_owner,
  sale_or_return_terms, sale_or_return_commission_rate, total_income,
  deposit_received, final_sale_price, owner_payout_amount, owner_payout_date,
  owner_payout_account_id, advertised_date, deposit_date, deposit_amount,
  purchase_vat_type
)
select
  2,                                    -- <<< the new account id from step 2
  reg, make, model, paid, sold, purchase_date, sale_date, status, notes,
  created_at, type, stock_number, owner_name, min_price, sale_price,
  received_date, fee, fee_vat, advertised, created_by_user_id, created_by_name,
  registration, stock_number_text, is_sale_or_return, sale_or_return_owner,
  sale_or_return_terms, sale_or_return_commission_rate, total_income,
  deposit_received, final_sale_price, owner_payout_amount, owner_payout_date,
  owner_payout_account_id, advertised_date, deposit_date, deposit_amount,
  purchase_vat_type
from cars
where account_id = 1;

-- Must return 36. If not, ROLLBACK.
select count(*) as copied from cars where account_id = 2;

commit;   -- change to ROLLBACK if the count is wrong


-- =====================================================================
-- STEP 4 (optional) — copy your 3 bank accounts
--
-- The CSV import asks which bank account the rows belong to. Without
-- this the new account has no accounts to choose from, and imported
-- transactions won't be attributable to an account.
-- I'd run this.
-- =====================================================================
-- begin;
-- insert into bank_accounts (account_id, account_name, account_type, is_default,
--                            sort_code, account_number, active)
-- select 2, account_name, account_type, is_default, sort_code, account_number, active
-- from bank_accounts where account_id = 1;
-- select count(*) from bank_accounts where account_id = 2;   -- expect 3
-- commit;


-- =====================================================================
-- STEP 5 — verify, and prove the old account is untouched
-- =====================================================================
select 'account 1 (original)' as which,
       (select count(*) from cars     where account_id = 1) as cars,
       (select count(*) from expenses where account_id = 1) as expenses,
       (select count(*) from income   where account_id = 1) as income
union all
select 'account 2 (clean)',
       (select count(*) from cars     where account_id = 2),
       (select count(*) from expenses where account_id = 2),
       (select count(*) from income   where account_id = 2);

-- Expect:
--   account 1  ->  36 cars, 482 expenses, 47 income   (unchanged)
--   account 2  ->  36 cars,   0 expenses,  0 income   (clean slate)

-- Every stock number now exists twice, once per account. That's fine —
-- stock numbers are only unique within an account, and the two accounts
-- never join to each other.


-- =====================================================================
-- ROLLBACK, if you change your mind
-- =====================================================================
-- delete from bank_accounts where account_id = 2;
-- delete from cars          where account_id = 2;
-- delete from accounts      where id = 2;
--
-- Account 1 is never written to by any of the above, so there is nothing
-- to undo there.


-- =====================================================================
-- HOUSEKEEPING — the stray account
--
-- There's an account id 7 ("THG", maxmichaelturner@gmail.com) created on
-- 26 July with 2 cars and no transactions. It looks like a test. Once
-- you've confirmed you don't need it:
--
--   delete from cars     where account_id = 7;
--   delete from accounts where id = 7;
--
-- Leaving it does no harm, but it's a third account under your name.
-- =====================================================================
