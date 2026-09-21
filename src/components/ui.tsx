import Link from 'next/link';
import { money, signedMoney, statusLabel } from '@/lib/format';

export function Stat({ label, value, sub, tone, big }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'pos' | 'neg' | 'neutral'; big?: boolean }) {
  const color = tone === 'pos' ? 'text-fleet-green' : tone === 'neg' ? 'text-fleet-red' : '';
  return (
    <div className="card card-pad">
      <p className="label">{label}</p>
      <p className={`tabular mt-1.5 font-semibold tracking-tight ${big ? 'text-3xl' : 'text-2xl'} ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-fleet-muted">{sub}</p>}
    </div>
  );
}

export function ProfitCell({ value, muted }: { value: number | null | undefined; muted?: boolean }) {
  if (value === null || value === undefined) return <span className="text-fleet-faint">—</span>;
  const tone = value > 0 ? 'text-fleet-green' : value < 0 ? 'text-fleet-red' : 'text-fleet-muted';
  return <span className={`tabular font-medium ${muted ? 'opacity-70' : ''} ${tone}`}>{signedMoney(value)}</span>;
}

export function StatusChip({ status, sor }: { status: string; sor?: boolean }) {
  const cls = status === 'sold' ? 'bg-fleet-green-dim text-fleet-green' : status === 'for_sale' ? 'bg-fleet-blue-dim text-fleet-blue' : 'bg-fleet-amber-dim text-fleet-amber';
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`chip ${cls}`}>{statusLabel[status] || status}</span>
      {sor && <span className="chip bg-fleet-purple-dim text-fleet-purple">SOR</span>}
    </span>
  );
}

export function Plate({ reg }: { reg: string | null }) {
  if (!reg) return <span className="text-fleet-faint">—</span>;
  return <span className="inline-block rounded border border-fleet-border-strong bg-[#fbd44b] px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-black">{reg}</span>;
}

export function Bars({ items, total, linkPrefix }: { items: { label: string; amount: number; href?: string }[]; total?: number; linkPrefix?: string }) {
  const max = Math.max(...items.map((i) => Math.abs(i.amount)), 1);
  const sum = total ?? items.reduce((s, i) => s + i.amount, 0);
  if (items.length === 0) return <p className="text-sm text-fleet-faint">Nothing in this period.</p>;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            {i.href ? <Link href={i.href} className="truncate capitalize hover:underline">{i.label}</Link> : <span className="truncate capitalize">{i.label}</span>}
            <span className="tabular ml-3 shrink-0 text-fleet-text-secondary">{money(i.amount)} <span className="text-fleet-faint">{sum ? `${Math.round((i.amount / sum) * 100)}%` : ''}</span></span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-fleet-input">
            <div className="h-full rounded-full bg-fleet-inverse/80" style={{ width: `${Math.max(2, (Math.abs(i.amount) / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Warn({ children }: { children: React.ReactNode }) {
  return <p className="rounded-fleet bg-fleet-amber-dim px-3 py-2 text-xs text-fleet-amber">{children}</p>;
}
