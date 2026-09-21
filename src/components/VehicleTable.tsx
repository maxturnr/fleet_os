'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowUpDown, Search } from 'lucide-react';
import type { VehicleFinancials } from '@/lib/types';
import { money, vehicleTitle } from '@/lib/format';
import { Plate, ProfitCell, StatusChip } from '@/components/ui';

type SortKey = 'days_in_stock' | 'stand_in_cost' | 'projected_profit' | 'realised_profit' | 'sold_date' | 'registration';

export function VehicleTable({ rows, view, from, to, q }: { rows: VehicleFinancials[]; view: string; from?: string; to?: string; q?: string }) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: view === 'sold' ? 'sold_date' : 'days_in_stock', dir: -1 });
  const [query, setQuery] = useState(q || '');

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const av = a[sort.key] as any, bv = b[sort.key] as any;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });
    return list;
  }, [rows, sort]);

  const toggle = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }));
  const nav = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { view, from, to, q: query, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    router.push(`/vehicles?${p.toString()}`);
  };

  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={`label cursor-pointer select-none whitespace-nowrap px-3 py-2 ${right ? 'text-right' : 'text-left'}`} onClick={() => toggle(k)}>
      <span className="inline-flex items-center gap-1">{children}<ArrowUpDown className={`h-3 w-3 ${sort.key === k ? 'opacity-100' : 'opacity-30'}`} /></span>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-fleet border border-fleet-border bg-fleet-surface p-0.5">
          {[['in_stock', 'In stock'], ['sold', 'Sold'], ['all', 'All']].map(([v, l]) => (
            <button key={v} onClick={() => nav({ view: v })} className={`rounded-[6px] px-3 py-1.5 text-xs font-medium ${view === v ? 'bg-fleet-inverse text-white dark:text-fleet-text' : 'text-fleet-muted hover:text-fleet-text'}`}>{l}</button>
          ))}
        </div>
        <form className="relative flex-1 min-w-[160px] max-w-xs" onSubmit={(e) => { e.preventDefault(); nav({ q: query }); }}>
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-fleet-faint" />
          <input className="input pl-8" placeholder="Reg, make, model…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </form>
        <div className="flex items-center gap-1 text-xs text-fleet-muted">
          <span className="hidden sm:inline">{view === 'sold' ? 'Sold' : 'Stocked'}</span>
          <input type="date" className="input w-auto py-1.5 text-xs" defaultValue={from} onChange={(e) => nav({ from: e.target.value || undefined })} />
          <span>–</span>
          <input type="date" className="input w-auto py-1.5 text-xs" defaultValue={to} onChange={(e) => nav({ to: e.target.value || undefined })} />
        </div>
      </div>

      {/* Desktop table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-fleet-border">
            <tr>
              <Th k="registration">Vehicle</Th>
              <th className="label px-3 py-2 text-left">Status</th>
              <Th k="stand_in_cost" right>Stand-in cost</Th>
              <th className="label px-3 py-2 text-right">{view === 'sold' ? 'Sold for' : 'Advertised'}</th>
              <Th k="projected_profit" right>Projected margin</Th>
              <Th k="realised_profit" right>Realised profit</Th>
              <Th k={view === 'sold' ? 'sold_date' : 'days_in_stock'} right>{view === 'sold' ? 'Sold' : 'Days in stock'}</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.vehicle_id} className="cursor-pointer border-b border-fleet-border last:border-0 hover:bg-fleet-input" onClick={() => router.push(`/vehicles/${r.vehicle_id}`)}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Plate reg={r.registration} />
                    <div className="min-w-0">
                      <Link href={`/vehicles/${r.vehicle_id}`} className="block truncate font-medium hover:underline">{vehicleTitle(r)}</Link>
                      <p className="truncate text-xs text-fleet-muted">{r.stock_id ? `#${r.stock_id} · ` : ''}{r.cost_count} cost{r.cost_count === 1 ? '' : 's'} · {money(r.total_costs)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5"><StatusChip status={r.status} sor={r.is_sale_or_return} /></td>
                <td className="tabular px-3 py-2.5 text-right">
                  {money(r.stand_in_cost)}
                  {r.missing_purchase_price && <span className="ml-1 text-fleet-amber" title="No purchase price recorded">!</span>}
                </td>
                <td className="tabular px-3 py-2.5 text-right text-fleet-text-secondary">{money(r.is_sold ? r.sale_price : r.advertised_price)}</td>
                <td className="px-3 py-2.5 text-right"><ProfitCell value={r.projected_profit} muted /></td>
                <td className="px-3 py-2.5 text-right"><ProfitCell value={r.realised_profit} /></td>
                <td className="tabular px-3 py-2.5 text-right text-fleet-text-secondary">{view === 'sold' ? (r.sold_date || '—') : <span className={r.days_in_stock > 60 ? 'text-fleet-amber' : ''}>{r.days_in_stock}d</span>}</td>
              </tr>
            ))}
            {sorted.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-fleet-faint">No vehicles match.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2 md:hidden">
        {sorted.map((r) => (
          <li key={r.vehicle_id}>
            <Link href={`/vehicles/${r.vehicle_id}`} className="card card-pad block">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{vehicleTitle(r)}</p>
                  <div className="mt-1 flex items-center gap-2"><Plate reg={r.registration} /><StatusChip status={r.status} sor={r.is_sale_or_return} /></div>
                </div>
                <div className="text-right">
                  <p className="label">{r.is_sold ? 'Realised' : 'Projected'}</p>
                  <ProfitCell value={r.is_sold ? r.realised_profit : r.projected_profit} />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><p className="label">Stand-in</p><p className="tabular">{money(r.stand_in_cost)}</p></div>
                <div><p className="label">{r.is_sold ? 'Sold for' : 'Advertised'}</p><p className="tabular">{money(r.is_sold ? r.sale_price : r.advertised_price)}</p></div>
                <div><p className="label">{r.is_sold ? 'Sold' : 'In stock'}</p><p className="tabular">{r.is_sold ? r.sold_date : `${r.days_in_stock}d`}</p></div>
              </div>
            </Link>
          </li>
        ))}
        {sorted.length === 0 && <li className="py-10 text-center text-sm text-fleet-faint">No vehicles match.</li>}
      </ul>
    </div>
  );
}
