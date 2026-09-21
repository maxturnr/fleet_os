import Link from 'next/link';
import { subDays, startOfMonth, startOfYear, format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { getDashboard, getPeriodSummary } from '@/lib/data/finance';
import { money, signedMoney, toISODate, vehicleTitle } from '@/lib/format';
import { PageHeader } from '@/components/AppShell';
import { Bars, Stat, Warn } from '@/components/ui';
import { PeriodPicker, RealisedToggle } from '@/components/DashboardControls';

export const metadata = { title: 'Dashboard' };

function resolvePeriod(p: string | undefined, from?: string, to?: string) {
  const today = new Date();
  switch (p) {
    case 'month': return { key: 'month', label: 'This month', start: toISODate(startOfMonth(today)), end: toISODate(today) };
    case '30': return { key: '30', label: 'Last 30 days', start: toISODate(subDays(today, 30)), end: toISODate(today) };
    case 'ytd': return { key: 'ytd', label: 'Year to date', start: toISODate(startOfYear(today)), end: toISODate(today) };
    case 'custom': if (from && to) return { key: 'custom', label: `${from} → ${to}`, start: from, end: to };
    // falls through
    default: return { key: '90', label: 'Last 90 days', start: toISODate(subDays(today, 90)), end: toISODate(today) };
  }
}

export default async function DashboardPage({ searchParams }: { searchParams: { period?: string; from?: string; to?: string; mode?: string } }) {
  const auth = await requireAuth();
  const period = resolvePeriod(searchParams.period, searchParams.from, searchParams.to);
  const mode = searchParams.mode === 'unrealised' ? 'unrealised' : 'realised';
  const [d, p] = await Promise.all([getDashboard(auth.dealership.id), getPeriodSummary(auth.dealership.id, period.start, period.end)]);

  const gone = [
    ...(d.where_money_went.purchases_90 ? [{ label: 'Buying stock', amount: d.where_money_went.purchases_90, href: '/vehicles?view=all' }] : []),
    ...d.where_money_went.costs_by_type.map((c) => ({ label: `${c.label} (vehicle costs)`, amount: c.amount, href: '/activity' })),
    ...d.where_money_went.overheads_by_category.map((c) => ({ label: `${c.label} (overhead)`, amount: c.amount })),
  ].sort((a, b) => b.amount - a.amount).slice(0, 8);

  const missing = p.sold.missing_purchase_price;

  return (
    <>
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}`}
        subtitle={<>{auth.dealership.trading_name || auth.dealership.company_name} · live from Pitch DMS · {format(new Date(d.generated_at), 'HH:mm')}</>}
        actions={<PeriodPicker current={period.key} from={searchParams.from} to={searchParams.to} mode={mode} />}
      />

      {/* Headline row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Estimated net position" value={money(d.net_position)} sub="cash + stock at cost + debtors − what you owe" big tone={d.net_position >= 0 ? 'pos' : 'neg'} />
        <Stat label="Cash in bank" value={money(d.cash.balance)} sub={d.cash.accounts.length ? d.cash.accounts.map((a) => `${a.name} ${money(a.balance)}`).join(' · ') : 'No bank accounts anchored yet'} />
        <Stat label="Capital tied up in stock" value={money(d.stock.capital_tied_up)} sub={`${d.stock.vehicles_in_stock} vehicles · avg ${d.stock.avg_days_in_stock}d${d.stock.aged_over_60 ? ` · ${d.stock.aged_over_60} over 60d` : ''}`} />
        <Stat label="Stock value (asking)" value={money(d.stock.stock_value)} sub={`${signedMoney(d.stock.unrealised_profit)} unrealised margin`} tone={d.stock.unrealised_profit >= 0 ? 'pos' : 'neg'} />
      </div>

      {/* Realised vs unrealised */}
      <section className="mt-5 grid gap-4 lg:grid-cols-5">
        <div className="card card-pad lg:col-span-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="label">{mode === 'realised' ? `Realised profit · ${period.label}` : 'Unrealised profit · in stock now'}</p>
              <p className={`tabular mt-1 text-3xl font-semibold tracking-tight ${(mode === 'realised' ? p.sold.realised_profit : d.stock.unrealised_profit) >= 0 ? 'text-fleet-green' : 'text-fleet-red'}`}>
                {signedMoney(mode === 'realised' ? p.sold.realised_profit : d.stock.unrealised_profit)}
              </p>
            </div>
            <RealisedToggle mode={mode} />
          </div>

          {mode === 'realised' ? (
            <>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <div><dt className="label">Vehicles sold</dt><dd className="tabular mt-0.5 text-base font-medium">{p.sold.vehicles_sold}</dd></div>
                <div><dt className="label">Revenue</dt><dd className="tabular mt-0.5 text-base font-medium">{money(p.sold.revenue)}</dd></div>
                <div><dt className="label">Avg days to sell</dt><dd className="tabular mt-0.5 text-base font-medium">{p.sold.avg_days_in_stock}</dd></div>
                <div><dt className="label">Bought for</dt><dd className="tabular mt-0.5 text-fleet-red">− {money(p.sold.purchase_cost)}</dd></div>
                <div><dt className="label">Prep &amp; costs</dt><dd className="tabular mt-0.5 text-fleet-red">− {money(p.sold.direct_costs)}</dd></div>
                <div><dt className="label">VAT on sales</dt><dd className="tabular mt-0.5 text-fleet-red">− {money(p.sold.output_vat)}</dd></div>
                {p.overheads.total > 0 && <div><dt className="label">Overheads</dt><dd className="tabular mt-0.5 text-fleet-red">− {money(p.overheads.total)}</dd></div>}
                {p.overheads.total > 0 && <div><dt className="label">Net after overheads</dt><dd className="tabular mt-0.5 font-medium">{signedMoney(p.net_profit)}</dd></div>}
              </dl>
              {missing > 0 && <div className="mt-3"><Warn>{missing} sold vehicle{missing > 1 ? 's have' : ' has'} no purchase price in the DMS and {missing > 1 ? 'are' : 'is'} excluded from realised profit.</Warn></div>}
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                {[['Last 30 days', d.realised.last_30, d.realised.sold_30], ['Last 90 days', d.realised.last_90, d.realised.sold_90], ['Year to date', d.realised.ytd, d.realised.sold_ytd]].map(([l, v, n]) => (
                  <div key={l as string} className="rounded-fleet bg-fleet-input px-3 py-2">
                    <p className="label">{l}</p>
                    <p className={`tabular text-sm font-semibold ${(v as number) >= 0 ? 'text-fleet-green' : 'text-fleet-red'}`}>{signedMoney(v as number)}</p>
                    <p className="text-fleet-faint">{n as number} sold</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-fleet-muted">If every car in stock sold at its asking price today, after purchase, costs to date and margin-scheme VAT.</p>
              <ul className="mt-3 divide-y divide-fleet-border">
                {d.where_money_went.top_capital_vehicles.map((v) => (
                  <li key={v.vehicle_id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/vehicles/${v.vehicle_id}`} className="hover:underline">{vehicleTitle(v)} <span className="text-fleet-muted">{v.registration}</span></Link>
                    <span className="tabular text-fleet-text-secondary">{money(v.capital_tied_up)} tied up · <span className={v.days_in_stock > 60 ? 'text-fleet-amber' : ''}>{v.days_in_stock}d</span></span>
                  </li>
                ))}
              </ul>
              <Link href="/vehicles" className="mt-3 inline-flex items-center gap-1 text-xs text-fleet-blue hover:underline">All stock <ArrowRight className="h-3 w-3" /></Link>
            </>
          )}
        </div>

        <div className="card card-pad lg:col-span-2">
          <p className="label">Where has the money gone?</p>
          <p className="mb-3 mt-1 text-xs text-fleet-muted">Biggest outflows, last 90 days</p>
          <Bars items={gone} />
          <div className="mt-4 space-y-1.5 border-t border-fleet-border pt-3 text-xs text-fleet-muted">
            <div className="flex justify-between"><span>Unpaid supplier bills (credit)</span><span className="tabular text-fleet-text">{money(d.stock.unpaid_costs)}</span></div>
            <div className="flex justify-between"><span>Customer deposits held</span><span className="tabular text-fleet-text">{money(d.stock.deposits_held)}</span></div>
            <div className="flex justify-between"><span>VAT on sales, last 90d</span><span className="tabular text-fleet-text">{money(d.realised.output_vat_90)}</span></div>
            <div className="flex justify-between"><span>Corp tax provision (DMS)</span><span className="tabular text-fleet-text">{money(d.balance_sheet.corp_tax_provision)}</span></div>
          </div>
          <Link href="/assistant?q=We%E2%80%99ve%20made%20money%20on%20paper%20but%20the%20bank%20doesn%E2%80%99t%20show%20it%20%E2%80%94%20where%20has%20the%20money%20gone%3F" className="btn btn-sm mt-4 w-full">Ask the AI to explain <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </section>

      {/* Tax strip */}
      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`VAT due · ${period.label}`} value={money(p.vat.net_due)} sub={`${money(p.vat.output)} on sales − ${money(p.vat.input)} reclaimable`} />
        <Stat label={`Corp tax est. · ${period.label}`} value={money(p.corporation_tax.estimate)} sub={`${Math.round(p.corporation_tax.rate * 100)}% of ${money(p.corporation_tax.taxable)}`} />
        <Stat label={`Vehicles sold · ${period.label}`} value={p.sold.vehicles_sold} sub={`${money(p.sold.revenue)} revenue`} />
        <Link href="/tax" className="card card-pad flex items-center justify-between text-sm hover:bg-fleet-input">
          <span>Tax detail &amp; accountant export</span><ArrowRight className="h-4 w-4 text-fleet-muted" />
        </Link>
      </section>
    </>
  );
}
