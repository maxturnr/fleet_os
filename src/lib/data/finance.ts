import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ActivityItem, AllocProgress, CostLine, Dashboard, PeriodSummary, QbAllocation, QbTransaction, TaxAssumptions, VehicleFinancials } from '@/lib/types';

/**
 * The only place Pitch Money talks to the database for money numbers.
 * Everything here goes through the v_* views and pm_* RPCs, which are scoped
 * to the caller's dealership memberships inside Postgres.
 */

const numify = <T extends Record<string, any>>(row: T): T => {
  const out: any = { ...row };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && !/date|_at$|_id$|registration|stock_id|mileage/.test(k)) out[k] = Number(v);
  }
  return out;
};

export type VehicleFilter = 'in_stock' | 'sold' | 'all';

export async function listVehicles(dealershipId: string, filter: VehicleFilter = 'in_stock', opts: { from?: string; to?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from('v_vehicle_financials').select('*').eq('dealership_id', dealershipId);
  if (filter === 'in_stock') q = q.eq('is_sold', false).order('days_in_stock', { ascending: false });
  else if (filter === 'sold') q = q.eq('is_sold', true).order('sold_date', { ascending: false });
  else q = q.order('is_sold').order('sold_date', { ascending: false, nullsFirst: true });
  if (opts.from) q = filter === 'sold' ? q.gte('sold_date', opts.from) : q.gte('in_stock_date', opts.from);
  if (opts.to) q = filter === 'sold' ? q.lte('sold_date', opts.to) : q.lte('in_stock_date', opts.to);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(numify) as VehicleFinancials[];
}

export async function getVehicle(vehicleId: string) {
  const supabase = await createClient();
  const [{ data: v, error }, { data: costs, error: cErr }] = await Promise.all([
    supabase.from('v_vehicle_financials').select('*').eq('vehicle_id', vehicleId).maybeSingle(),
    supabase.from('v_cost_lines').select('*').eq('vehicle_id', vehicleId).order('cost_date', { ascending: false }).order('created_at', { ascending: false }),
  ]);
  if (error) throw error;
  if (cErr) throw cErr;
  if (!v) return null;
  return { vehicle: numify(v) as VehicleFinancials, costs: (costs || []).map(numify) as CostLine[] };
}

export async function getDashboard(dealershipId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('pm_dashboard', { p_dealership_id: dealershipId });
  if (error) throw error;
  return data as Dashboard;
}

export async function getPeriodSummary(dealershipId: string, start: string, end: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('pm_period_summary', { p_start: start, p_end: end, p_dealership_id: dealershipId });
  if (error) throw error;
  return data as PeriodSummary;
}

export async function listActivity(dealershipId: string, limit = 60) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('v_activity').select('*').eq('dealership_id', dealershipId).order('at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []).map(numify) as ActivityItem[];
}

export async function listRecentCosts(dealershipId: string, limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('v_cost_lines').select('*').eq('dealership_id', dealershipId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []).map(numify) as CostLine[];
}

export async function getTaxAssumptions(dealershipId: string): Promise<TaxAssumptions> {
  const supabase = await createClient();
  const { data } = await supabase.from('pm_tax_assumptions').select('*').eq('dealership_id', dealershipId).maybeSingle();
  return (data ? numify(data) : { dealership_id: dealershipId, corp_tax_rate: 0.19, vat_rate: 0.2, vat_quarter_start: null, notes: null }) as TaxAssumptions;
}

/** Compact vehicle list used as the AI's context (in-stock + recently sold). */
export async function getAiContext(dealershipId: string) {
  const supabase = await createClient();
  const today = new Date();
  const d90 = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10);
  const ytd = `${today.getFullYear()}-01-01`;
  const [dash, p90, pYtd, vehicles, overheads] = await Promise.all([
    getDashboard(dealershipId),
    getPeriodSummary(dealershipId, d90, today.toISOString().slice(0, 10)),
    getPeriodSummary(dealershipId, ytd, today.toISOString().slice(0, 10)),
    supabase.from('v_vehicle_financials').select('registration, make, model, status, is_sold, is_sale_or_return, missing_purchase_price, in_stock_date, sold_date, days_in_stock, purchase_price, advertised_price, sale_price, total_costs, stand_in_cost, output_vat, realised_profit, projected_profit, unpaid_costs, margin_scheme')
      .eq('dealership_id', dealershipId).or(`is_sold.eq.false,sold_date.gte.${d90}`).order('is_sold').order('days_in_stock', { ascending: false }).limit(120),
    supabase.from('v_overheads').select('expense_date, amount, category, supplier, description').eq('dealership_id', dealershipId).gte('expense_date', d90).order('expense_date', { ascending: false }).limit(100),
  ]);
  const pYtdSlim = { ...pYtd, sold: { ...pYtd.sold, vehicles: undefined } };
  return { dashboard: dash, last_90_days: p90, year_to_date: pYtdSlim, vehicles: (vehicles.data || []).map(numify), overheads_last_90: (overheads.data || []).map(numify) };
}

/* ---------------------------------------------------------------------------
 * QuickBooks transactions + allocations
 * Every pound that left the bank is a row here. Allocating it to a car (or to
 * overheads) is what turns the bank statement into per-car profit.
 * ------------------------------------------------------------------------- */

export type TxnFilter = 'todo' | 'done' | 'vehicle' | 'overhead' | 'money_in' | 'all';

export async function listTransactions(
  dealershipId: string,
  filter: TxnFilter = 'todo',
  opts: { from?: string; to?: string; q?: string; limit?: number } = {},
) {
  const supabase = await createClient();
  let q = supabase.from('v_qb_transactions').select('*').eq('dealership_id', dealershipId);

  if (filter === 'money_in') q = q.in('txn_type', ['Deposit', 'Invoice']);
  else if (filter !== 'all') q = q.in('txn_type', ['Expense', 'Cheque']);

  if (filter === 'todo') q = q.in('alloc_status', ['todo', 'partial']);
  else if (filter === 'done') q = q.eq('alloc_status', 'done');
  else if (filter === 'vehicle') q = q.eq('alloc_status', 'done').eq('is_overhead', false);
  else if (filter === 'overhead') q = q.eq('is_overhead', true);

  if (opts.from) q = q.gte('txn_date', opts.from);
  if (opts.to) q = q.lte('txn_date', opts.to);
  if (opts.q) {
    const s = opts.q.replace(/[%,]/g, ' ').trim();
    if (s) q = q.or(`memo.ilike.%${s}%,name.ilike.%${s}%,category.ilike.%${s}%,account.ilike.%${s}%,registrations.ilike.%${s}%`);
  }

  const { data, error } = await q
    .order('txn_date', { ascending: false })
    .order('amount')
    .limit(opts.limit ?? 300);
  if (error) throw error;
  return (data || []).map(numify) as QbTransaction[];
}

export async function getTransaction(id: string) {
  const supabase = await createClient();
  const [{ data: txn, error }, { data: splits, error: sErr }] = await Promise.all([
    supabase.from('v_qb_transactions').select('*').eq('id', id).maybeSingle(),
    supabase.from('v_qb_allocations').select('*').eq('transaction_id', id).order('amount', { ascending: false }),
  ]);
  if (error) throw error;
  if (sErr) throw sErr;
  if (!txn) return null;
  return { txn: numify(txn) as QbTransaction, splits: (splits || []).map(numify) as QbAllocation[] };
}

export async function getAllocProgress(dealershipId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('pm_alloc_progress', { p_dealership_id: dealershipId });
  if (error) throw error;
  return data as AllocProgress;
}

/** Cars to pick from when splitting — reg, make, model, in-stock flag. */
export async function listVehiclePicker(dealershipId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_vehicle_financials')
    .select('vehicle_id, registration, make, model, is_sold, sold_date, in_stock_date')
    .eq('dealership_id', dealershipId)
    .order('is_sold')
    .order('in_stock_date', { ascending: false });
  if (error) throw error;
  return (data || []) as { vehicle_id: string; registration: string; make: string | null; model: string | null; is_sold: boolean }[];
}
