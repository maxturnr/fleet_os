'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';

const TABS = [
  { v: 'todo', label: 'To allocate' },
  { v: 'vehicle', label: 'On cars' },
  { v: 'overhead', label: 'Overheads' },
  { v: 'done', label: 'Done' },
  { v: 'money_in', label: 'Money in' },
  { v: 'all', label: 'Everything' },
] as const;

export default function TransactionFilters({ filter, from, to, q }: { filter: string; from?: string; to?: string; q?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(q || '');

  const go = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    router.push(`/transactions?${next.toString()}`);
  };

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.v} type="button" onClick={() => go({ filter: t.v })}
            className={`chip border px-2.5 py-1 ${filter === t.v ? 'border-transparent bg-fleet-inverse text-white dark:text-fleet-text' : 'border-fleet-border text-fleet-text-secondary hover:bg-fleet-input'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="label">From</span>
          <input type="date" defaultValue={from} className="input" onChange={(e) => go({ from: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">To</span>
          <input type="date" defaultValue={to} className="input" onChange={(e) => go({ to: e.target.value })} />
        </label>
        <form className="flex flex-1 items-end gap-2" onSubmit={(e) => { e.preventDefault(); go({ q: search }); }}>
          <label className="block min-w-[12rem] flex-1">
            <span className="label">Search</span>
            <input value={search} placeholder="Supplier, reg, memo, category…" className="input"
              onChange={(e) => setSearch(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-sm"><Search className="h-3.5 w-3.5" /> Find</button>
        </form>
      </div>
    </div>
  );
}
