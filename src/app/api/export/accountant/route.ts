import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getPeriodSummary } from '@/lib/data/finance';

export const dynamic = 'force-dynamic';

const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (cells: unknown[]) => cells.map(csvCell).join(',');

export async function GET(req: Request) {
  const auth = await requireAuth().catch(() => null);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return NextResponse.json({ error: 'start and end (YYYY-MM-DD) required' }, { status: 400 });
  }

  const supabase = await createClient();
  const [summary, costs, overheads] = await Promise.all([
    getPeriodSummary(auth.dealership.id, start, end),
    supabase.from('v_cost_lines').select('*').eq('dealership_id', auth.dealership.id).gte('cost_date', start).lte('cost_date', end).order('cost_date'),
    supabase.from('v_overheads').select('*').eq('dealership_id', auth.dealership.id).gte('expense_date', start).lte('expense_date', end).order('expense_date'),
  ]);

  const name = auth.dealership.trading_name || auth.dealership.company_name || 'dealership';
  const lines: string[] = [];
  lines.push(row([`Pitch Money export — ${name}`]));
  lines.push(row([`Period`, start, end, `Generated`, new Date().toISOString()]));
  lines.push(row(['All figures GBP. Realised profit = sale price − purchase − vehicle costs − margin-scheme VAT. Estimates, not filed returns.']));
  lines.push('');

  lines.push(row(['SUMMARY']));
  lines.push(row(['Vehicles sold', summary.sold.vehicles_sold]));
  lines.push(row(['Revenue', summary.sold.revenue]));
  lines.push(row(['Purchase cost of vehicles sold', summary.sold.purchase_cost]));
  lines.push(row(['Direct vehicle costs (on vehicles sold)', summary.sold.direct_costs]));
  lines.push(row(['Extra income on vehicles sold', summary.sold.extra_income]));
  lines.push(row(['Output VAT (margin scheme)', summary.sold.output_vat]));
  lines.push(row(['Realised profit', summary.sold.realised_profit]));
  lines.push(row(['Overheads in period', summary.overheads.total]));
  lines.push(row(['Net profit after overheads', summary.net_profit]));
  lines.push(row(['Input VAT reclaimable (costs + overheads dated in period)', summary.vat.input]));
  lines.push(row(['Net VAT due (est.)', summary.vat.net_due]));
  lines.push(row([`Corporation tax est. @ ${Math.round(summary.corporation_tax.rate * 100)}%`, summary.corporation_tax.estimate]));
  lines.push(row(['Vehicle costs dated in period (all vehicles)', summary.costs_in_period]));
  if (summary.sold.missing_purchase_price) lines.push(row([`WARNING: ${summary.sold.missing_purchase_price} sold vehicle(s) have no purchase price and are excluded from profit`]));
  lines.push('');

  lines.push(row(['VEHICLES SOLD']));
  lines.push(row(['Sold date', 'Registration', 'Make', 'Model', 'Sale price', 'Purchase price', 'Vehicle costs', 'Output VAT', 'Realised profit', 'Days in stock']));
  for (const v of summary.sold.vehicles) lines.push(row([v.sold_date, v.registration, v.make, v.model, v.sale_price, v.purchase_price, v.total_costs, v.output_vat, v.realised_profit, v.days_in_stock]));
  lines.push('');

  lines.push(row(['VEHICLE COSTS IN PERIOD']));
  lines.push(row(['Date', 'Registration', 'Make', 'Model', 'Type', 'Supplier', 'Description', 'Amount (gross)', 'VAT type', 'VAT amount', 'Payment status', 'Receipt URL', 'Entered by']));
  for (const c of (costs.data || []) as any[]) lines.push(row([c.cost_date, c.registration, c.make, c.model, c.cost_type === 'other' ? c.cost_type_other || 'other' : c.cost_type, c.supplier, c.description, c.amount, c.vat_type, c.vat_amount, c.payment_status, c.invoice_url, c.created_by_name]));
  lines.push('');

  lines.push(row(['OVERHEADS IN PERIOD']));
  lines.push(row(['Date', 'Category', 'Supplier', 'Description', 'Amount', 'VAT type', 'Payment status', 'Entered by']));
  for (const o of (overheads.data || []) as any[]) lines.push(row([o.expense_date, o.category, o.supplier, o.description, o.amount, o.vat_type, o.payment_status, o.created_by_name]));

  const csv = '﻿' + lines.join('\r\n');
  const filename = `pitch-money-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${start}-to-${end}.csv`;
  return new NextResponse(csv, {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${filename}"` },
  });
}
