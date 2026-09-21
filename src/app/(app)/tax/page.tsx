import { subDays, startOfYear, startOfQuarter, format } from 'date-fns';
import { Download } from 'lucide-react';
import { canSeeTax, canWrite, requireAuth } from '@/lib/auth';
import { getPeriodSummary, getTaxAssumptions } from '@/lib/data/finance';
import { money, toISODate } from '@/lib/format';
import { PageHeader } from '@/components/AppShell';
import { Stat, Warn } from '@/components/ui';
import { TaxAssumptionsForm } from '@/components/TaxAssumptionsForm';
import { PeriodPicker } from '@/components/DashboardControls';

export const metadata = { title: 'Tax & export' };

export default async function TaxPage({ searchParams }: { searchParams: { period?: string; from?: string; to?: string } }) {
  const auth = await requireAuth();
  if (!canSeeTax(auth.role)) return <Warn>Tax estimates are only visible to owners and managers.</Warn>;

  const today = new Date();
  const presets: Record<string, { label: string; start: string; end: string }> = {
    quarter: { label: 'This VAT quarter', start: toISODate(startOfQuarter(today)), end: toISODate(today) },
    '90': { label: 'Last 90 days', start: toISODate(subDays(today, 90)), end: toISODate(today) },
    ytd: { label: 'Year to date', start: toISODate(startOfYear(today)), end: toISODate(today) },
    month: { label: 'This month', start: format(today, 'yyyy-MM-01'), end: toISODate(today) },
    '30': { label: 'Last 30 days', start: toISODate(subDays(today, 30)), end: toISODate(today) },
  };
  const key = searchParams.period === 'custom' && searchParams.from && searchParams.to ? 'custom' : (presets[searchParams.period || ''] ? searchParams.period! : 'ytd');
  const period = key === 'custom' ? { label: `${searchParams.from} → ${searchParams.to}`, start: searchParams.from!, end: searchParams.to! } : presets[key];

  const [p, assumptions] = await Promise.all([getPeriodSummary(auth.dealership.id, period.start, period.end), getTaxAssumptions(auth.dealership.id)]);
  const vatReg = auth.dealership.vat_registered;
  const exportHref = `/api/export/accountant?start=${period.start}&end=${period.end}`;

  return (
    <>
      <PageHeader
        title="Tax & export"
        subtitle={`${period.label} · ${period.start} → ${period.end}`}
        actions={
          <>
            <PeriodPicker current={key} from={searchParams.from} to={searchParams.to} mode="realised" />
            <a href={exportHref} className="btn-primary btn-sm"><Download className="h-3.5 w-3.5" /> Export for accountant</a>
          </>
        }
      />

      <Warn>These are working estimates from the numbers in Pitch DMS, not filed returns. Your accountant has the final word.</Warn>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="VAT payable (est.)" value={money(p.vat.net_due)} sub={vatReg ? `${money(p.vat.output)} margin-scheme output − ${money(p.vat.input)} input` : 'Not VAT registered in DMS'} tone={p.vat.net_due > 0 ? 'neg' : 'neutral'} />
        <Stat label="Corporation tax (est.)" value={money(p.corporation_tax.estimate)} sub={`${Math.round(p.corporation_tax.rate * 100)}% × ${money(p.corporation_tax.taxable)} taxable`} tone={p.corporation_tax.estimate > 0 ? 'neg' : 'neutral'} />
        <Stat label="Set aside for HMRC" value={money(p.vat.net_due + p.corporation_tax.estimate)} sub="VAT + corporation tax for this period" big />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <h2 className="mb-3 text-sm font-semibold">How the VAT figure is built</h2>
          <dl className="space-y-2 text-sm">
            <Row k={`Output VAT on ${p.sold.vehicles_sold} sales (1/6 of margin, margin-scheme cars)`} v={money(p.vat.output, { pennies: true })} />
            <Row k="Input VAT reclaimable on vehicle costs + overheads dated in period" v={`− ${money(p.vat.input, { pennies: true })}`} />
            <Row k="Net VAT due" v={money(p.vat.net_due, { pennies: true })} bold />
          </dl>
          <p className="mt-3 text-xs text-fleet-muted">Cars marked no_vat / not VAT-active contribute no output VAT. Costs with VAT type &quot;none&quot; are not reclaimed.</p>
        </div>
        <div className="card card-pad">
          <h2 className="mb-3 text-sm font-semibold">How the corporation tax figure is built</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Realised profit on cars sold in period (after VAT)" v={money(p.sold.realised_profit, { pennies: true })} />
            <Row k="Business overheads in period" v={`− ${money(p.overheads.total, { pennies: true })}`} />
            <Row k="Taxable profit (floored at £0)" v={money(p.corporation_tax.taxable, { pennies: true })} />
            <Row k={`× ${Math.round(p.corporation_tax.rate * 100)}% rate`} v={money(p.corporation_tax.estimate, { pennies: true })} bold />
          </dl>
          {p.sold.missing_purchase_price > 0 && <p className="mt-3 text-xs text-fleet-amber">{p.sold.missing_purchase_price} sold vehicle(s) with no purchase price are excluded — the real figure is likely different.</p>}
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <TaxAssumptionsForm assumptions={assumptions} writable={canWrite(auth.role)} />
        <div className="card card-pad">
          <h2 className="mb-2 text-sm font-semibold">Export for accountant</h2>
          <p className="text-sm text-fleet-muted">One CSV, three sections: every vehicle sold in the period with purchase, costs, VAT and profit; every cost line in the period; overheads. Same numbers as this page.</p>
          <a href={exportHref} className="btn mt-3"><Download className="h-4 w-4" /> Download CSV · {period.label}</a>
        </div>
      </section>
    </>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${bold ? 'border-t border-fleet-border pt-2 font-semibold' : ''}`}>
      <dt className="text-fleet-text-secondary">{k}</dt>
      <dd className="tabular shrink-0">{v}</dd>
    </div>
  );
}
