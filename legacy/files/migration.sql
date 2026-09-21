-- ═══════════════════════════════════════════
-- FleetOS v2 — Database Migration
-- Run this in Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════

-- 1. Add new columns to cars table
alter table cars add column if not exists type text default 'owned';
alter table cars add column if not exists stock_number text;
alter table cars add column if not exists owner_name text;
alter table cars add column if not exists min_price numeric;
alter table cars add column if not exists sale_price numeric;
alter table cars add column if not exists received_date date;
alter table cars add column if not exists fee numeric;
alter table cars add column if not exists fee_vat text default 'none';

-- 2. Update existing cars to be 'owned' type and assign stock numbers
update cars set type = 'owned' where type is null;

-- Assign stock numbers to existing owned cars
do $$
declare
  r record;
  counter int := 1;
begin
  for r in (select id from cars where type = 'owned' and stock_number is null order by created_at asc)
  loop
    update cars set stock_number = 'STK-' || lpad(counter::text, 3, '0') where id = r.id;
    counter := counter + 1;
  end loop;
end $$;

-- 3. Add new columns to transactions table
alter table transactions add column if not exists stock_id bigint;
alter table transactions add column if not exists source text default 'manual';
alter table transactions add column if not exists assigned boolean default true;
alter table transactions add column if not exists qb_id text unique;
alter table transactions add column if not exists qb_type text;
alter table transactions add column if not exists raw_data jsonb;

-- Link existing transactions to cars by reg plate
update transactions t
set stock_id = c.id,
    assigned = true
from cars c
where t.car_reg = c.reg
  and t.stock_id is null
  and t.car_reg is not null;

-- Mark manual transactions without a car as overhead (assigned = true, no stock_id)
update transactions
set assigned = true
where car_reg is null and assigned is null;

-- 4. Add settings for QB
insert into settings (key, value) values ('qb_connected', 'false')
on conflict (key) do nothing;

insert into settings (key, value) values ('qb_access_token', '')
on conflict (key) do nothing;

insert into settings (key, value) values ('qb_refresh_token', '')
on conflict (key) do nothing;

insert into settings (key, value) values ('qb_realm_id', '')
on conflict (key) do nothing;

-- 5. Disable RLS on all tables
alter table cars disable row level security;
alter table transactions disable row level security;
alter table balance_sheet disable row level security;
alter table settings disable row level security;

-- Verify
select 'cars' as tbl, count(*) from cars
union all
select 'transactions', count(*) from transactions
union all
select 'balance_sheet', count(*) from balance_sheet
union all
select 'settings', count(*) from settings;
