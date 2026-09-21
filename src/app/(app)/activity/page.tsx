import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Car, Receipt } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { listActivity } from '@/lib/data/finance';
import { ago, money, vehicleTitle } from '@/lib/format';
import { PageHeader } from '@/components/AppShell';

export const metadata = { title: 'Activity' };

const ICON = { cost: ArrowDownRight, sale: ArrowUpRight, overhead: Receipt, stock_in: Car } as const;
const TONE = { cost: 'text-fleet-red bg-fleet-red-dim', sale: 'text-fleet-green bg-fleet-green-dim', overhead: 'text-fleet-amber bg-fleet-amber-dim', stock_in: 'text-fleet-blue bg-fleet-blue-dim' } as const;

export default async function ActivityPage() {
  const auth = await requireAuth();
  const items = await listActivity(auth.dealership.id, 80);

  return (
    <>
      <PageHeader title="Activity" subtitle="Who added which cost, which cars came in and went out." />
      <ul className="card divide-y divide-fleet-border">
        {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-fleet-faint">Nothing yet.</li>}
        {items.map((a) => {
          const Icon = ICON[a.kind];
          const text =
            a.kind === 'cost' ? <><span className="capitalize">{a.label}</span> cost{a.detail ? ` · ${a.detail}` : ''}</>
            : a.kind === 'sale' ? <>Sold{a.detail ? ` to ${a.detail}` : ''}</>
            : a.kind === 'overhead' ? <><span className="capitalize">{a.label}</span> overhead{a.detail ? ` · ${a.detail}` : ''}</>
            : <>Added to stock{a.detail ? ` · #${a.detail}` : ''}</>;
          return (
            <li key={`${a.kind}-${a.ref_id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${TONE[a.kind]}`}><Icon className="h-3.5 w-3.5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  {a.vehicle_id ? <Link href={`/vehicles/${a.vehicle_id}`} className="font-medium hover:underline">{vehicleTitle(a)} {a.registration && <span className="text-fleet-muted">{a.registration}</span>}</Link> : <span className="font-medium">Business</span>}
                  <span className="text-fleet-text-secondary"> — {text}</span>
                </p>
                <p className="text-[11px] text-fleet-faint">{a.actor ? `${a.actor} · ` : ''}{ago(a.at)}</p>
              </div>
              <span className={`tabular shrink-0 ${a.kind === 'sale' ? 'text-fleet-green' : ''}`}>{a.kind === 'stock_in' && !a.amount ? '' : money(a.amount, { pennies: a.kind === 'cost' })}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
