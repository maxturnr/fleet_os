-- Pitch Money — QuickBooks transaction allocation layer
-- Applied to the `pitch` Supabase project on 2026-09-22 as three migrations:
--   pm_qb_transactions_unique_key   (idempotent import key)
--   pm_qb_seed_allocations          (auto-allocation of the imported rows)
--   pm_qb_allocation_layer          (views + save RPC used by /transactions)
--
-- Every payment that left the bank now lives in qb_transactions, imported from
-- the QuickBooks "Transaction List by Date" report and keyed on
-- md5(date|amount|memo|type) so re-importing can never duplicate a row.
-- qb_transaction_allocations splits one payment across any number of cars
-- and/or overheads, each split carrying its own VAT status and VAT amount.

create unique index if not exists qb_transactions_dealership_key_uidx
  on public.qb_transactions (dealership_id, qb_key);

create index if not exists qb_alloc_txn_idx on public.qb_transaction_allocations (transaction_id);
create index if not exists qb_alloc_vehicle_idx on public.qb_transaction_allocations (vehicle_id);

create or replace view public.v_qb_transactions
with (security_invoker = false) as
select
  t.id, t.dealership_id, t.txn_date, t.txn_type, t.doc_num, t.name, t.memo,
  t.account, t.category, t.amount,
  case when t.amount < 0 then -t.amount else 0 end as spend,
  case when t.amount > 0 then t.amount else 0 end as money_in,
  t.is_overhead, t.reconciled,
  coalesce(a.n, 0) as split_count,
  coalesce(a.allocated, 0) as allocated,
  case when t.amount < 0 then (-t.amount) - coalesce(a.allocated, 0) else 0 end as unallocated,
  case
    when t.txn_type in ('Transfer','Deposit','Invoice','Journal Entry') then 'not_spend'
    when coalesce(a.n,0) = 0 then 'todo'
    when abs((case when t.amount < 0 then -t.amount else t.amount end) - coalesce(a.allocated,0)) <= 0.01 then 'done'
    else 'partial'
  end as alloc_status,
  a.vehicle_ids, a.registrations
from public.qb_transactions t
left join lateral (
  select count(*) n, sum(al.amount) allocated,
         array_remove(array_agg(distinct al.vehicle_id), null) vehicle_ids,
         string_agg(distinct v.registration, ', ') registrations
  from public.qb_transaction_allocations al
  left join public.vehicles v on v.id = al.vehicle_id
  where al.transaction_id = t.id
) a on true
where t.dealership_id in (select public.pm_user_dealership_ids());

create or replace view public.v_qb_allocations
with (security_invoker = false) as
select a.id, a.dealership_id, a.transaction_id, a.amount, a.vehicle_id,
       v.registration, v.make, v.model, a.is_overhead, a.category,
       a.vat_status, a.vat_amount, a.notes,
       t.txn_date, t.txn_type, t.name as payee, t.memo, t.amount as txn_amount
from public.qb_transaction_allocations a
join public.qb_transactions t on t.id = a.transaction_id
left join public.vehicles v on v.id = a.vehicle_id
where a.dealership_id in (select public.pm_user_dealership_ids());

-- Replace every allocation on one transaction in a single call.
-- p_splits: [{ amount, vehicle_id, is_overhead, category, vat_status, vat_amount, notes }]
create or replace function public.pm_save_allocations(p_transaction_id uuid, p_splits jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_txn public.qb_transactions;
  v_gross numeric; v_sum numeric := 0; s jsonb; v_vehicle uuid; v_oh boolean;
begin
  select * into v_txn from public.qb_transactions where id = p_transaction_id;
  if v_txn.id is null then raise exception 'Transaction not found'; end if;
  if v_txn.dealership_id not in (select public.pm_user_dealership_ids()) then
    raise exception 'Not your dealership'; end if;
  if coalesce(public.pm_user_role(v_txn.dealership_id), 'viewer') not in ('owner','manager','sales') then
    raise exception 'Your role is read-only'; end if;

  v_gross := abs(coalesce(v_txn.amount, 0));

  for s in select * from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb)) loop
    if coalesce((s->>'amount')::numeric, 0) <= 0 then
      raise exception 'Every split needs a positive amount'; end if;
    v_vehicle := nullif(s->>'vehicle_id','')::uuid;
    v_oh := coalesce((s->>'is_overhead')::boolean, false);
    if v_vehicle is null and not v_oh then
      raise exception 'Every split needs either a vehicle or the overhead flag'; end if;
    if v_vehicle is not null and not exists (
      select 1 from public.vehicles where id = v_vehicle and dealership_id = v_txn.dealership_id
    ) then raise exception 'Vehicle is not in this dealership'; end if;
    v_sum := v_sum + (s->>'amount')::numeric;
  end loop;

  if v_sum - v_gross > 0.01 then
    raise exception 'Splits total %, more than the transaction (%)', v_sum, v_gross; end if;

  delete from public.qb_transaction_allocations where transaction_id = p_transaction_id;

  insert into public.qb_transaction_allocations
    (dealership_id, transaction_id, amount, vehicle_id, is_overhead, category, vat_status, vat_amount, notes)
  select v_txn.dealership_id, p_transaction_id, (e->>'amount')::numeric,
         nullif(e->>'vehicle_id','')::uuid, coalesce((e->>'is_overhead')::boolean, false),
         nullif(e->>'category',''), coalesce(nullif(e->>'vat_status',''), 'unknown'),
         nullif(e->>'vat_amount','')::numeric, nullif(e->>'notes','')
  from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb)) e;

  update public.qb_transactions
  set split_count = (select count(*) from public.qb_transaction_allocations where transaction_id = p_transaction_id),
      is_overhead = (select coalesce(bool_and(is_overhead), false) from public.qb_transaction_allocations where transaction_id = p_transaction_id),
      reconciled = (v_sum >= v_gross - 0.01 and v_sum > 0),
      reconciled_at = case when (v_sum >= v_gross - 0.01 and v_sum > 0) then now() else null end,
      updated_at = now()
  where id = p_transaction_id;

  return jsonb_build_object('transaction_id', p_transaction_id, 'splits', v_sum,
                            'gross', v_gross, 'unallocated', greatest(v_gross - v_sum, 0));
end;
$$;

create or replace function public.pm_alloc_progress(p_dealership_id uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with d as (select coalesce(p_dealership_id, (select public.pm_user_dealership_ids() limit 1)) id),
  t as (select * from public.v_qb_transactions
        where dealership_id = (select id from d) and txn_type in ('Expense','Cheque'))
  select jsonb_build_object(
    'rows', (select count(*) from t),
    'spend', (select coalesce(sum(spend),0) from t),
    'done_rows', (select count(*) from t where alloc_status = 'done'),
    'done_value', (select coalesce(sum(allocated),0) from t),
    'todo_rows', (select count(*) from t where alloc_status in ('todo','partial')),
    'todo_value', (select coalesce(sum(unallocated),0) from t where alloc_status in ('todo','partial')),
    'vehicle_value', (select coalesce(sum(a.amount),0) from public.v_qb_allocations a
                      where a.dealership_id = (select id from d) and a.vehicle_id is not null),
    'overhead_value', (select coalesce(sum(a.amount),0) from public.v_qb_allocations a
                       where a.dealership_id = (select id from d) and a.is_overhead)
  );
$$;

revoke all on function public.pm_save_allocations(uuid, jsonb) from public, anon;
revoke all on function public.pm_alloc_progress(uuid) from public, anon;
grant execute on function public.pm_save_allocations(uuid, jsonb) to authenticated;
grant execute on function public.pm_alloc_progress(uuid) to authenticated;
revoke all on public.v_qb_transactions from public, anon;
revoke all on public.v_qb_allocations from public, anon;
grant select on public.v_qb_transactions to authenticated;
grant select on public.v_qb_allocations to authenticated;
