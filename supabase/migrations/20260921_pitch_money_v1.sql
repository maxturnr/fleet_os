-- Pitch Money v1 — financial views, RPCs and tables layered on the Pitch DMS schema.
-- Nothing here duplicates operational data: every view reads the DMS tables live.

-- ---------------------------------------------------------------------------
-- Membership helper (used by every view / RPC to scope by dealership)
-- ---------------------------------------------------------------------------
create or replace function public.pm_user_dealership_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select dealership_id from public.dealership_users
  where user_id = auth.uid() and removed_at is null
$$;
revoke all on function public.pm_user_dealership_ids() from public;
grant execute on function public.pm_user_dealership_ids() to authenticated, service_role;

create or replace function public.pm_user_role(p_dealership_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select role from public.dealership_users
  where user_id = auth.uid() and dealership_id = p_dealership_id and removed_at is null
  order by created_at limit 1
$$;
grant execute on function public.pm_user_role(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- v_vehicle_financials — one row per vehicle, the "true money picture".
-- Formulas mirror src/lib/finance/pnl.ts + vat.ts in the DMS so both apps agree.
-- ---------------------------------------------------------------------------
create or replace view public.v_vehicle_financials as
with costs as (
  select vehicle_id,
         coalesce(sum(price),0)::numeric(12,2) as total_costs,
         count(*) as cost_count,
         max(cost_date) as last_cost_date,
         coalesce(sum(price) filter (where payment_status = 'credit'),0)::numeric(12,2) as unpaid_costs,
         coalesce(sum(case when vat_type='included' then price - price/1.2
                           when vat_type='excluded' then price*0.2 else 0 end),0)::numeric(12,2) as input_vat
  from public.vehicle_costs group by vehicle_id
),
refunds as (
  select vehicle_id, coalesce(sum(amount),0)::numeric(12,2) as refunds
  from public.expense_refunds where vehicle_id is not null group by vehicle_id
),
extra as (
  select vehicle_id, coalesce(sum(coalesce(net_amount, amount)),0)::numeric(12,2) as extra_income
  from public.other_income
  where vehicle_id is not null and income_type not in ('purchase','deposit')
  group by vehicle_id
),
deal as (
  select distinct on (vehicle_id) vehicle_id, id as deal_id, deal_date,
         (coalesce(deal_price,0) - coalesce(price_reduction_amount,0))::numeric(12,2) as deal_net,
         deposit_amount, deposit_paid, customer_name
  from public.deals
  where complete = true and coalesce(cancelled,false) = false
  order by vehicle_id, deal_date desc, created_at desc
),
sb as (
  select distinct on (vehicle_id) vehicle_id, selling_price, date_sold, price_paid
  from public.stock_book_entries order by vehicle_id, updated_at desc
),
base as (
  select v.id as vehicle_id, v.dealership_id, v.registration, v.make, v.model, v.derivative, v.stock_id,
         v.status, v.colour, v.mileage,
         (p.is_sale_or_return is true or v.vehicle_type = 'sale_or_return') as is_sale_or_return,
         coalesce(v.in_stock_date, v.created_at) as stock_date,
         coalesce(s.date_sold::timestamptz, v.sold_date) as sold_date,
         coalesce(nullif(p.purchase_price,0), nullif(v.purchase_price,0), s.price_paid, 0)::numeric(12,2) as purchase_price,
         coalesce(nullif(v.price,0), p.advertise_price, 0)::numeric(12,2) as advertised_price,
         case when v.status = 'sold' then coalesce(s.selling_price, d.deal_net, v.sale_price) end::numeric(12,2) as sale_price,
         case when p.margin_scheme in ('vat_margin_scheme','vat_included','vat_excluded','no_vat') then p.margin_scheme
              when p.margin_scheme = 'true' then 'vat_margin_scheme'
              when v.vat_type = 'marginal' then 'vat_margin_scheme'
              else 'no_vat' end as margin_scheme,
         coalesce(p.fee,0)::numeric(12,2) as sor_fee, p.fee_vat_type,
         coalesce(p.deposit_held, case when d.deposit_paid then d.deposit_amount end, 0)::numeric(12,2) as deposit_held,
         coalesce(c.total_costs,0) - coalesce(r.refunds,0) as total_costs,
         coalesce(c.cost_count,0) as cost_count, c.last_cost_date, coalesce(c.unpaid_costs,0) as unpaid_costs,
         coalesce(c.input_vat,0) as input_vat,
         coalesce(e.extra_income,0) as extra_income,
         d.deal_id, d.customer_name,
         dl.vat_registered, dl.vat_effective_date
  from public.vehicles v
  left join public.vehicle_pnl p on p.vehicle_id = v.id
  left join costs c on c.vehicle_id = v.id
  left join refunds r on r.vehicle_id = v.id
  left join extra e on e.vehicle_id = v.id
  left join deal d on d.vehicle_id = v.id
  left join sb s on s.vehicle_id = v.id
  left join public.dealerships dl on dl.id = v.dealership_id
),
calc as (
  select b.*,
    (b.status = 'sold') as is_sold,
    case when b.vat_registered and (b.vat_effective_date is null or coalesce(b.sold_date, now())::date >= b.vat_effective_date) then true else false end as vat_active,
    case when b.is_sale_or_return then
           case when b.fee_vat_type = 'included' then round(b.sor_fee/1.2,2) else b.sor_fee end
         else b.sale_price end as revenue
  from base b
),
vat as (
  select c.*,
    case when c.is_sale_or_return then 0
         when not c.vat_active then 0
         when c.margin_scheme = 'vat_margin_scheme' then round(greatest(0, coalesce(c.sale_price, c.advertised_price) - c.purchase_price)/6, 2)
         when c.margin_scheme = 'vat_included' then round(coalesce(c.sale_price, c.advertised_price) - coalesce(c.sale_price, c.advertised_price)/1.2, 2)
         when c.margin_scheme = 'vat_excluded' then round(coalesce(c.sale_price, c.advertised_price)*0.2, 2)
         else 0 end::numeric(12,2) as output_vat
  from calc c
)
select
  vehicle_id, dealership_id, registration, make, model, derivative, stock_id, status, colour, mileage,
  is_sale_or_return, is_sold,
  stock_date::date as in_stock_date, sold_date::date as sold_date,
  greatest(0, (coalesce(sold_date, now())::date - stock_date::date))::int as days_in_stock,
  purchase_price, advertised_price, sale_price, margin_scheme, vat_active,
  total_costs, cost_count, last_cost_date, unpaid_costs, input_vat, extra_income, deposit_held,
  (case when is_sale_or_return then 0 else purchase_price end + total_costs)::numeric(12,2) as stand_in_cost,
  output_vat,
  -- realised: only once sold
  case when is_sold and revenue is not null
       then (revenue + extra_income - (case when is_sale_or_return then 0 else purchase_price end) - total_costs - output_vat)
       end::numeric(12,2) as realised_profit,
  -- unrealised: projected at advertised price while in stock
  case when not is_sold and advertised_price > 0
       then (advertised_price + extra_income - (case when is_sale_or_return then 0 else purchase_price end) - total_costs - output_vat)
       end::numeric(12,2) as projected_profit,
  case when not is_sold then advertised_price end::numeric(12,2) as stock_value,
  case when not is_sold then (case when is_sale_or_return then 0 else purchase_price end + total_costs) end::numeric(12,2) as capital_tied_up,
  deal_id, customer_name
from vat
where dealership_id in (select public.pm_user_dealership_ids());

comment on view public.v_vehicle_financials is 'Pitch Money: per-vehicle stand-in cost, realised/unrealised profit. Scoped to the caller''s dealerships.';
revoke all on public.v_vehicle_financials from anon;
grant select on public.v_vehicle_financials to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- v_cost_lines — every cost line with who/when, for the detail page + activity feed
-- ---------------------------------------------------------------------------
create or replace view public.v_cost_lines as
select vc.id as cost_id, vc.vehicle_id, v.dealership_id, v.registration, v.make, v.model, v.stock_id,
       vc.cost_date, vc.cost_type, vc.cost_type_other, vc.price as amount, vc.vat_type, vc.supplier,
       vc.description, coalesce(vc.invoice_url, e.invoice_url) as invoice_url, vc.payment_status, vc.due_date, vc.paid_date,
       vc.created_at, vc.updated_at,
       e.id as expense_id, e.created_by_user_id,
       trim(coalesce(up.first_name,'') || ' ' || coalesce(up.last_name,'')) as created_by_name,
       case when vc.vat_type='included' then round(vc.price - vc.price/1.2,2)
            when vc.vat_type='excluded' then round(vc.price*0.2,2) else 0 end as vat_amount
from public.vehicle_costs vc
join public.vehicles v on v.id = vc.vehicle_id
left join public.expenses e on e.vehicle_cost_id = vc.id
left join public.user_profiles up on up.id = e.created_by_user_id
where v.dealership_id in (select public.pm_user_dealership_ids());
revoke all on public.v_cost_lines from anon;
grant select on public.v_cost_lines to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- v_overheads — non-vehicle expenses (business overheads)
-- ---------------------------------------------------------------------------
create or replace view public.v_overheads as
select e.id, e.dealership_id, e.expense_date, e.amount, e.description, e.supplier,
       coalesce(e.expense_category, e.breakeven_bucket, 'other') as category, e.vat_type, e.payment_status, e.is_recurring,
       trim(coalesce(up.first_name,'') || ' ' || coalesce(up.last_name,'')) as created_by_name, e.created_at
from public.expenses e
left join public.user_profiles up on up.id = e.created_by_user_id
where e.vehicle_id is null
  and e.dealership_id in (select public.pm_user_dealership_ids());
revoke all on public.v_overheads from anon;
grant select on public.v_overheads to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- v_activity — recent money events across the dealership
-- ---------------------------------------------------------------------------
create or replace view public.v_activity as
select * from (
  select 'cost'::text as kind, c.cost_id as ref_id, c.vehicle_id, c.registration, c.make, c.model,
         c.amount, c.cost_type as label, c.supplier as detail, c.created_by_name as actor, c.created_at as at, c.dealership_id
  from public.v_cost_lines c
  union all
  select 'sale', d.id, d.vehicle_id, v.registration, v.make, v.model,
         d.deal_price, 'sold', d.customer_name, trim(coalesce(up.first_name,'')||' '||coalesce(up.last_name,'')), coalesce(d.updated_at, d.created_at), d.dealership_id
  from public.deals d join public.vehicles v on v.id = d.vehicle_id
  left join public.user_profiles up on up.id = d.created_by
  where d.complete = true and coalesce(d.cancelled,false) = false
    and d.dealership_id in (select public.pm_user_dealership_ids())
  union all
  select 'overhead', o.id, null, null, null, null, o.amount, o.category, o.supplier, o.created_by_name, o.created_at, o.dealership_id
  from public.v_overheads o
  union all
  select 'stock_in', v.id, v.id, v.registration, v.make, v.model,
         coalesce(nullif(p.purchase_price,0), nullif(v.purchase_price,0), 0), 'added to stock', v.stock_id,
         trim(coalesce(up.first_name,'')||' '||coalesce(up.last_name,'')), v.created_at, v.dealership_id
  from public.vehicles v left join public.vehicle_pnl p on p.vehicle_id = v.id
  left join public.user_profiles up on up.id = v.added_by_user_id
  where v.dealership_id in (select public.pm_user_dealership_ids())
) a;
revoke all on public.v_activity from anon;
grant select on public.v_activity to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- pm_period_summary — realised P&L, overheads, VAT and tax for a date range
-- ---------------------------------------------------------------------------
create or replace function public.pm_period_summary(p_start date, p_end date, p_dealership_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d_id uuid;
  v_sold jsonb; v_over jsonb; v_out_vat numeric; v_in_vat numeric; v_corp_rate numeric := 0.19;
  v_res jsonb;
begin
  d_id := coalesce(p_dealership_id, (select public.pm_user_dealership_ids() limit 1));
  if d_id is null or d_id not in (select public.pm_user_dealership_ids()) then
    raise exception 'not a member of this dealership';
  end if;

  select jsonb_build_object(
    'vehicles_sold', count(*),
    'revenue', coalesce(sum(coalesce(sale_price,0)),0),
    'purchase_cost', coalesce(sum(case when is_sale_or_return then 0 else purchase_price end),0),
    'direct_costs', coalesce(sum(total_costs),0),
    'extra_income', coalesce(sum(extra_income),0),
    'output_vat', coalesce(sum(output_vat),0),
    'realised_profit', coalesce(sum(realised_profit),0),
    'avg_days_in_stock', coalesce(round(avg(days_in_stock)),0)
  ) into v_sold
  from public.v_vehicle_financials
  where dealership_id = d_id and is_sold and sold_date between p_start and p_end;

  select jsonb_build_object(
    'total', coalesce(sum(amount),0),
    'by_category', coalesce(jsonb_agg(jsonb_build_object('category', category, 'amount', amt) order by amt desc), '[]'::jsonb)
  ) into v_over
  from (select category, sum(amount) amt from public.v_overheads
        where dealership_id = d_id and expense_date between p_start and p_end group by category) o;

  -- input VAT reclaimable on costs + overheads dated in the period (only if VAT registered)
  select coalesce(sum(vat_amount),0) into v_in_vat
  from public.v_cost_lines where dealership_id = d_id and cost_date between p_start and p_end;
  select v_in_vat + coalesce(sum(case when vat_type='included' then amount - amount/1.2 when vat_type='excluded' then amount*0.2 else 0 end),0)
  into v_in_vat from public.v_overheads where dealership_id = d_id and expense_date between p_start and p_end;
  if not exists (select 1 from public.dealerships where id = d_id and vat_registered) then v_in_vat := 0; end if;

  v_out_vat := (v_sold->>'output_vat')::numeric;
  select corp_tax_rate into v_corp_rate from public.pm_tax_assumptions where dealership_id = d_id;
  v_corp_rate := coalesce(v_corp_rate, 0.19);

  v_res := jsonb_build_object(
    'start', p_start, 'end', p_end, 'dealership_id', d_id,
    'sold', v_sold,
    'overheads', v_over,
    'net_profit', (v_sold->>'realised_profit')::numeric - (v_over->>'total')::numeric,
    'vat', jsonb_build_object('output', v_out_vat, 'input', round(v_in_vat,2), 'net_due', round(v_out_vat - v_in_vat,2)),
    'corporation_tax', jsonb_build_object(
        'rate', v_corp_rate,
        'taxable', greatest(0, (v_sold->>'realised_profit')::numeric - (v_over->>'total')::numeric),
        'estimate', round(greatest(0, (v_sold->>'realised_profit')::numeric - (v_over->>'total')::numeric) * v_corp_rate, 2))
  );
  return v_res;
end $$;
grant execute on function public.pm_period_summary(date, date, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- pm_dashboard — the top-level money position
-- ---------------------------------------------------------------------------
create or replace function public.pm_dashboard(p_dealership_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d_id uuid; stock jsonb; cash numeric; realised jsonb; gone jsonb; res jsonb;
  bs_debtors numeric := 0; bs_liab numeric := 0; bs_corp numeric := 0; bs_parts numeric := 0; bs_mech numeric := 0;
  ytd_start date := date_trunc('year', current_date)::date;
begin
  d_id := coalesce(p_dealership_id, (select public.pm_user_dealership_ids() limit 1));
  if d_id is null or d_id not in (select public.pm_user_dealership_ids()) then
    raise exception 'not a member of this dealership';
  end if;

  select jsonb_build_object(
    'vehicles_in_stock', count(*) filter (where not is_sold),
    'stock_value', coalesce(sum(stock_value),0),
    'capital_tied_up', coalesce(sum(capital_tied_up),0),
    'unrealised_profit', coalesce(sum(projected_profit),0),
    'unpaid_costs', coalesce(sum(unpaid_costs) filter (where not is_sold),0),
    'deposits_held', coalesce(sum(deposit_held) filter (where not is_sold),0),
    'avg_days_in_stock', coalesce(round(avg(days_in_stock) filter (where not is_sold)),0),
    'aged_over_60', count(*) filter (where not is_sold and days_in_stock > 60)
  ) into stock from public.v_vehicle_financials where dealership_id = d_id;

  select coalesce(sum(balance),0) into cash from public.v_account_balance where dealership_id = d_id and coalesce(is_active,true);

  select coalesce(debtors,0), coalesce(other_liabilities,0), coalesce(corp_tax,0), coalesce(parts30,0), coalesce(mech30,0)
    into bs_debtors, bs_liab, bs_corp, bs_parts, bs_mech
  from public.balance_sheet_inputs where dealership_id = d_id limit 1;
  bs_debtors := coalesce(bs_debtors,0); bs_liab := coalesce(bs_liab,0); bs_corp := coalesce(bs_corp,0);
  bs_parts := coalesce(bs_parts,0); bs_mech := coalesce(bs_mech,0);

  select jsonb_build_object(
    'last_30', coalesce(sum(realised_profit) filter (where sold_date >= current_date - 30),0),
    'last_90', coalesce(sum(realised_profit) filter (where sold_date >= current_date - 90),0),
    'ytd', coalesce(sum(realised_profit) filter (where sold_date >= ytd_start),0),
    'all_time', coalesce(sum(realised_profit),0),
    'sold_30', count(*) filter (where sold_date >= current_date - 30),
    'sold_90', count(*) filter (where sold_date >= current_date - 90),
    'sold_ytd', count(*) filter (where sold_date >= ytd_start),
    'output_vat_90', coalesce(sum(output_vat) filter (where sold_date >= current_date - 90),0)
  ) into realised from public.v_vehicle_financials where dealership_id = d_id and is_sold;

  -- "Where has the money gone?" — last 90 days of spend by bucket
  select jsonb_build_object(
    'costs_by_type', coalesce((select jsonb_agg(jsonb_build_object('label', cost_type, 'amount', amt) order by amt desc)
                               from (select cost_type, sum(amount) amt from public.v_cost_lines
                                     where dealership_id = d_id and cost_date >= current_date - 90 group by cost_type) t),'[]'::jsonb),
    'overheads_by_category', coalesce((select jsonb_agg(jsonb_build_object('label', category, 'amount', amt) order by amt desc)
                               from (select category, sum(amount) amt from public.v_overheads
                                     where dealership_id = d_id and expense_date >= current_date - 90 group by category) t),'[]'::jsonb),
    'top_capital_vehicles', coalesce((select jsonb_agg(jsonb_build_object('vehicle_id', vehicle_id, 'registration', registration, 'make', make, 'model', model,
                                     'capital_tied_up', capital_tied_up, 'days_in_stock', days_in_stock) order by capital_tied_up desc)
                               from (select * from public.v_vehicle_financials where dealership_id = d_id and not is_sold order by capital_tied_up desc limit 5) t),'[]'::jsonb),
    'purchases_90', coalesce((select sum(case when is_sale_or_return then 0 else purchase_price end) from public.v_vehicle_financials
                              where dealership_id = d_id and in_stock_date >= current_date - 90),0)
  ) into gone;

  res := jsonb_build_object(
    'dealership_id', d_id,
    'stock', stock,
    'realised', realised,
    'cash', jsonb_build_object('balance', cash,
              'accounts', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(display_name, account_name), 'balance', balance, 'anchored_on', anchored_on))
                                    from public.v_account_balance where dealership_id = d_id and coalesce(is_active,true)),'[]'::jsonb)),
    'balance_sheet', jsonb_build_object(
        'debtors', bs_debtors, 'other_liabilities', bs_liab,
        'corp_tax_provision', bs_corp, 'parts_30', bs_parts, 'mech_30', bs_mech),
    'net_position', cash + (stock->>'capital_tied_up')::numeric + bs_debtors
                    - (stock->>'unpaid_costs')::numeric - bs_liab - bs_corp
                    - bs_parts - bs_mech - (stock->>'deposits_held')::numeric,
    'where_money_went', gone,
    'generated_at', now()
  );
  return res;
end $$;
grant execute on function public.pm_dashboard(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- pm_add_vehicle_cost — writes the SAME two rows the DMS writes (vehicle_costs + expenses mirror)
-- ---------------------------------------------------------------------------
create or replace function public.pm_add_vehicle_cost(
  p_vehicle_id uuid, p_cost_date date, p_cost_type text, p_amount numeric,
  p_vat_type text default 'included', p_supplier text default null, p_description text default null,
  p_cost_type_other text default null, p_invoice_url text default null, p_payment_status text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare d_id uuid; cost_id uuid;
begin
  select dealership_id into d_id from public.vehicles where id = p_vehicle_id;
  if d_id is null or d_id not in (select public.pm_user_dealership_ids()) then
    raise exception 'vehicle not found or not in your dealership';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;

  insert into public.vehicle_costs (vehicle_id, cost_date, cost_type, cost_type_other, price, supplier, description, vat_type, invoice_url, payment_status)
  values (p_vehicle_id, p_cost_date, coalesce(p_cost_type,'other'), case when p_cost_type='other' then p_cost_type_other end,
          p_amount, p_supplier, p_description, coalesce(p_vat_type,'included'), p_invoice_url, p_payment_status)
  returning id into cost_id;

  insert into public.expenses (dealership_id, expense_date, amount, supplier, description, invoice_url, vehicle_id, vehicle_cost_id,
                               cost_type, cost_type_other, vat_type, created_by_user_id, payment_status)
  values (d_id, p_cost_date, p_amount, p_supplier, p_description, p_invoice_url, p_vehicle_id, cost_id,
          coalesce(p_cost_type,'other'), case when p_cost_type='other' then p_cost_type_other end, coalesce(p_vat_type,'included'), auth.uid(), p_payment_status);
  return cost_id;
end $$;
grant execute on function public.pm_add_vehicle_cost(uuid, date, text, numeric, text, text, text, text, text, text) to authenticated, service_role;

create or replace function public.pm_update_vehicle_cost(
  p_cost_id uuid, p_cost_date date, p_cost_type text, p_amount numeric,
  p_vat_type text default 'included', p_supplier text default null, p_description text default null,
  p_cost_type_other text default null, p_invoice_url text default null, p_payment_status text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare d_id uuid;
begin
  select v.dealership_id into d_id from public.vehicle_costs vc join public.vehicles v on v.id = vc.vehicle_id where vc.id = p_cost_id;
  if d_id is null or d_id not in (select public.pm_user_dealership_ids()) then raise exception 'cost not found'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  update public.vehicle_costs set cost_date = p_cost_date, cost_type = coalesce(p_cost_type,'other'),
    cost_type_other = case when p_cost_type='other' then p_cost_type_other end, price = p_amount, supplier = p_supplier,
    description = p_description, vat_type = coalesce(p_vat_type,'included'), invoice_url = coalesce(p_invoice_url, invoice_url),
    payment_status = p_payment_status, updated_at = now()
  where id = p_cost_id;
  update public.expenses set expense_date = p_cost_date, cost_type = coalesce(p_cost_type,'other'),
    cost_type_other = case when p_cost_type='other' then p_cost_type_other end, amount = p_amount, supplier = p_supplier,
    description = p_description, vat_type = coalesce(p_vat_type,'included'), invoice_url = coalesce(p_invoice_url, invoice_url),
    payment_status = p_payment_status, updated_at = now()
  where vehicle_cost_id = p_cost_id;
end $$;
grant execute on function public.pm_update_vehicle_cost(uuid, date, text, numeric, text, text, text, text, text, text) to authenticated, service_role;

create or replace function public.pm_delete_vehicle_cost(p_cost_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare d_id uuid;
begin
  select v.dealership_id into d_id from public.vehicle_costs vc join public.vehicles v on v.id = vc.vehicle_id where vc.id = p_cost_id;
  if d_id is null or d_id not in (select public.pm_user_dealership_ids()) then raise exception 'cost not found'; end if;
  delete from public.expenses where vehicle_cost_id = p_cost_id;
  delete from public.vehicle_costs where id = p_cost_id;
end $$;
grant execute on function public.pm_delete_vehicle_cost(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- ai_conversations — chat history per user
-- ---------------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  title text,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_conversations_user_idx on public.ai_conversations(user_id, updated_at desc);
alter table public.ai_conversations enable row level security;
drop policy if exists "own conversations" on public.ai_conversations;
create policy "own conversations" on public.ai_conversations
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.ai_conversations to authenticated;

-- ---------------------------------------------------------------------------
-- pm_tax_assumptions — editable assumptions for the tax estimate cards
-- ---------------------------------------------------------------------------
create table if not exists public.pm_tax_assumptions (
  dealership_id uuid primary key references public.dealerships(id) on delete cascade,
  corp_tax_rate numeric not null default 0.19,
  vat_rate numeric not null default 0.20,
  vat_quarter_start date,
  notes text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.pm_tax_assumptions enable row level security;
drop policy if exists "dealership members" on public.pm_tax_assumptions;
create policy "dealership members" on public.pm_tax_assumptions
  for all to authenticated
  using (dealership_id in (select public.pm_user_dealership_ids()))
  with check (dealership_id in (select public.pm_user_dealership_ids()));
grant select, insert, update on public.pm_tax_assumptions to authenticated;
