-- Pitch Money v1 fixes (applied after 20260921_pitch_money_v1.sql):
--  * v_vehicle_financials: flag missing_purchase_price (mirrors DMS pnl.ts: no profit when buy = 0),
--    SOR projected profit = net fee, expose sor_fee / sor_fee_net
--  * pm_period_summary: overhead total bug, per-vehicle list, costs in period + by type

drop view if exists public.v_activity;
drop view if exists public.v_vehicle_financials;
create view public.v_vehicle_financials as
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
    (not b.is_sale_or_return and b.purchase_price = 0) as missing_purchase_price,
    case when b.vat_registered and (b.vat_effective_date is null or coalesce(b.sold_date, now())::date >= b.vat_effective_date) then true else false end as vat_active,
    case when b.fee_vat_type = 'included' then round(b.sor_fee/1.2,2) else b.sor_fee end as sor_fee_net,
    case when b.is_sale_or_return then
           case when b.sor_fee > 0 then (case when b.fee_vat_type = 'included' then round(b.sor_fee/1.2,2) else b.sor_fee end) end
         else b.sale_price end as revenue
  from base b
),
vat as (
  select c.*,
    case when c.is_sale_or_return then 0
         when c.missing_purchase_price then 0
         when not c.vat_active then 0
         when c.margin_scheme = 'vat_margin_scheme' then round(greatest(0, coalesce(c.sale_price, c.advertised_price) - c.purchase_price)/6, 2)
         when c.margin_scheme = 'vat_included' then round(coalesce(c.sale_price, c.advertised_price) - coalesce(c.sale_price, c.advertised_price)/1.2, 2)
         when c.margin_scheme = 'vat_excluded' then round(coalesce(c.sale_price, c.advertised_price)*0.2, 2)
         else 0 end::numeric(12,2) as output_vat
  from calc c
)
select
  vehicle_id, dealership_id, registration, make, model, derivative, stock_id, status, colour, mileage,
  is_sale_or_return, is_sold, missing_purchase_price,
  stock_date::date as in_stock_date, sold_date::date as sold_date,
  greatest(0, (coalesce(sold_date, now())::date - stock_date::date))::int as days_in_stock,
  purchase_price, advertised_price, sale_price, margin_scheme, vat_active, sor_fee, sor_fee_net,
  total_costs, cost_count, last_cost_date, unpaid_costs, input_vat, extra_income, deposit_held,
  (case when is_sale_or_return then 0 else purchase_price end + total_costs)::numeric(12,2) as stand_in_cost,
  output_vat,
  case when is_sold and revenue is not null and not missing_purchase_price
       then (revenue + extra_income - (case when is_sale_or_return then 0 else purchase_price end) - total_costs - output_vat)
       end::numeric(12,2) as realised_profit,
  case when not is_sold and not missing_purchase_price then
         case when is_sale_or_return then (case when sor_fee > 0 then sor_fee_net + extra_income - total_costs end)
              when advertised_price > 0 then (advertised_price + extra_income - purchase_price - total_costs - output_vat) end
       end::numeric(12,2) as projected_profit,
  case when not is_sold then advertised_price end::numeric(12,2) as stock_value,
  case when not is_sold then (case when is_sale_or_return then 0 else purchase_price end + total_costs) end::numeric(12,2) as capital_tied_up,
  deal_id, customer_name
from vat
where dealership_id in (select public.pm_user_dealership_ids());

comment on view public.v_vehicle_financials is 'Pitch Money: per-vehicle stand-in cost, realised/unrealised profit. Scoped to the caller''s dealerships.';
revoke all on public.v_vehicle_financials from anon;
grant select on public.v_vehicle_financials to authenticated, service_role;

create view public.v_activity as
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
    'missing_purchase_price', count(*) filter (where missing_purchase_price),
    'avg_days_in_stock', coalesce(round(avg(days_in_stock)),0),
    'vehicles', coalesce(jsonb_agg(jsonb_build_object('vehicle_id', vehicle_id, 'registration', registration, 'make', make, 'model', model,
                  'sold_date', sold_date, 'sale_price', sale_price, 'purchase_price', purchase_price, 'total_costs', total_costs,
                  'output_vat', output_vat, 'realised_profit', realised_profit, 'days_in_stock', days_in_stock) order by sold_date desc), '[]'::jsonb)
  ) into v_sold
  from public.v_vehicle_financials
  where dealership_id = d_id and is_sold and sold_date between p_start and p_end;

  select jsonb_build_object(
    'total', coalesce(sum(amt),0),
    'by_category', coalesce(jsonb_agg(jsonb_build_object('category', category, 'amount', amt) order by amt desc), '[]'::jsonb)
  ) into v_over
  from (select category, sum(amount) amt from public.v_overheads
        where dealership_id = d_id and expense_date between p_start and p_end group by category) o;

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
    'costs_in_period', (select coalesce(sum(amount),0) from public.v_cost_lines where dealership_id = d_id and cost_date between p_start and p_end),
    'costs_by_type', (select coalesce(jsonb_agg(jsonb_build_object('label', cost_type, 'amount', amt) order by amt desc),'[]'::jsonb)
                      from (select cost_type, sum(amount) amt from public.v_cost_lines where dealership_id = d_id and cost_date between p_start and p_end group by cost_type) t),
    'net_profit', (v_sold->>'realised_profit')::numeric - (v_over->>'total')::numeric,
    'vat', jsonb_build_object('output', v_out_vat, 'input', round(v_in_vat,2), 'net_due', round(v_out_vat - v_in_vat,2)),
    'corporation_tax', jsonb_build_object(
        'rate', v_corp_rate,
        'taxable', greatest(0, (v_sold->>'realised_profit')::numeric - (v_over->>'total')::numeric),
        'estimate', round(greatest(0, (v_sold->>'realised_profit')::numeric - (v_over->>'total')::numeric) * v_corp_rate, 2))
  );
  return v_res;
end $$;
