import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { canWrite, requireAuth } from '@/lib/auth';
import { getVehicle } from '@/lib/data/finance';
import { dateShort, money, signedMoney, vehicleTitle } from '@/lib/format';
import { Plate, StatusChip, Warn } from '@/components/ui';
import { CostList } from '@/components/CostList';
import { AddCostButton } from '@/components/CostForm';

export const metadata = { title: 'Vehicle' };

export default async function VehiclePage({ params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const data = await getVehicle(params.id);
  if (!data || data.vehicle.dealership_id !== auth.dealership.id) notFound();
  const { vehicle: v, costs } = data;
  const dms = process.env.NEXT_PUBLIC_DMS_URL || 'https://app.pitchdms.com';
  const writable = canWrite(auth.role);

  const price = v.is_sold ? v.sale_price : v.advertised_price;
  const profit = v.is_sold ? v.realised_profit : v.projected_profit;
  const purchase = v.is_sale_or_return ? 0 : v.purchase_price;

  const lines: { label: string; value: number | null; sign: '+' | '−'; muted?: boolean }[] = [
    { label: v.is_sold ? 'Sale price' : 'Advertised price', value: price, sign: '+' },
    ...(v.is_sale_or_return ? [{ label: 'SOR fee (net)', value: v.sor_fee_net, sign: '+' as const }] : []),
    ...(v.extra_income ? [{ label: 'Extra income', value: v.extra_income, sign: '+' as const }] : []),
    ...(!v.is_sale_or_return ? [{ label: 'Purchase price', value: purchase, sign: '−' as const }] : []),
    { label: `Costs (${v.cost_count})`, value: v.total_costs, sign: '−' },
    ...(v.output_vat ? [{ label: `VAT on sale (${v.margin_scheme === 'vat_margin_scheme' ? 'margin scheme' : v.margin_scheme.replace('_', ' ')})`, value: v.output_vat, sign: '−' as const }] : []),
  ];

  return (
    <>
      <Link href="/vehicles" className="mb-3 inline-flex items-center gap-1 text-xs text-fleet-muted hover:text-fleet-text"><ArrowLeft className="h-3.5 w-3.5" /> Vehicles</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{vehicleTitle(v)}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-fleet-muted">
            <Plate reg={v.registration} />
            <StatusChip status={v.status} sor={v.is_sale_or_return} />
            {v.derivative && <span className="truncate">{v.derivative}</span>}
            {v.stock_id && <span>#{v.stock_id}</span>}
            {v.mileage != null && <span>{v.mileage.toLocaleString('en-GB')} mi</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a className="btn btn-sm" href={`${dms}/vehicles/${v.vehicle_id}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> DMS</a>
          {writable && <AddCostButton vehicleId={v.vehicle_id} vehicleLabel={`${vehicleTitle(v)} ${v.registration || ''}`} />}
        </div>
      </div>

      {v.missing_purchase_price && (
        <div className="mb-4"><Warn>No purchase price is recorded for this vehicle in Pitch DMS, so profit can&apos;t be calculated yet. Add it on the vehicle&apos;s P&amp;L tab in the DMS.</Warn></div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="card card-pad lg:col-span-2">
          <p className="label">{v.is_sold ? 'Realised profit' : 'Projected profit'}</p>
          <p className={`tabular mt-1 text-3xl font-semibold tracking-tight ${profit == null ? 'text-fleet-faint' : profit >= 0 ? 'text-fleet-green' : 'text-fleet-red'}`}>{profit == null ? '—' : signedMoney(profit)}</p>
          {price ? <p className="mt-1 text-xs text-fleet-muted">{profit != null ? `${Math.round((profit / price) * 100)}% of ${v.is_sold ? 'sale' : 'asking'} price` : ''}</p> : null}

          <dl className="mt-5 space-y-2 text-sm">
            {lines.map((l) => (
              <div key={l.label} className="flex items-center justify-between">
                <dt className="text-fleet-text-secondary">{l.label}</dt>
                <dd className={`tabular ${l.sign === '−' ? 'text-fleet-red' : ''}`}>{l.value == null ? '—' : `${l.sign} ${money(l.value, { pennies: true })}`}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-fleet-border pt-2 font-medium">
              <dt>Stand-in cost</dt>
              <dd className="tabular">{money(v.stand_in_cost, { pennies: true })}</dd>
            </div>
          </dl>

          <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
            <div><dt className="label">In stock</dt><dd className="mt-0.5">{dateShort(v.in_stock_date)}</dd></div>
            <div><dt className="label">{v.is_sold ? 'Sold' : 'Days in stock'}</dt><dd className="mt-0.5">{v.is_sold ? dateShort(v.sold_date) : `${v.days_in_stock} days`}</dd></div>
            {v.is_sold && <div><dt className="label">Customer</dt><dd className="mt-0.5 truncate">{v.customer_name || '—'}</dd></div>}
            {v.unpaid_costs > 0 && <div><dt className="label">Unpaid (credit)</dt><dd className="mt-0.5 text-fleet-amber">{money(v.unpaid_costs)}</dd></div>}
            {v.deposit_held > 0 && <div><dt className="label">Deposit held</dt><dd className="mt-0.5">{money(v.deposit_held)}</dd></div>}
            <div><dt className="label">VAT scheme</dt><dd className="mt-0.5 capitalize">{v.margin_scheme.replace(/_/g, ' ')}{!v.vat_active && ' (not active)'}</dd></div>
          </dl>
        </section>

        <section className="lg:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Cost breakdown</h2>
            <span className="text-xs text-fleet-muted">{money(v.total_costs, { pennies: true })} across {v.cost_count} line{v.cost_count === 1 ? '' : 's'}</span>
          </div>
          <CostList costs={costs} vehicleId={v.vehicle_id} writable={writable} />
        </section>
      </div>
    </>
  );
}
