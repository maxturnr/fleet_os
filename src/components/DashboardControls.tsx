'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

const PERIODS = [['month', 'This month'], ['30', '30d'], ['90', '90d'], ['ytd', 'YTD'], ['custom', 'Custom']];

export function PeriodPicker({ current, from, to, mode }: { current: string; from?: string; to?: string; mode: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [f, setF] = useState(from || '');
  const [t, setT] = useState(to || '');
  const [custom, setCustom] = useState(current === 'custom');

  const go = (period: string, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams(params.toString());
    p.set('period', period);
    p.set('mode', mode);
    Object.entries(extra).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    if (period !== 'custom') { p.delete('from'); p.delete('to'); }
    router.push(`?${p.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-fleet border border-fleet-border bg-fleet-surface p-0.5">
        {PERIODS.map(([k, l]) => (
          <button key={k} onClick={() => (k === 'custom' ? setCustom(true) : (setCustom(false), go(k)))} className={`rounded-[6px] px-2.5 py-1.5 text-xs font-medium ${current === k || (k === 'custom' && custom) ? 'bg-fleet-inverse text-white dark:text-fleet-text' : 'text-fleet-muted hover:text-fleet-text'}`}>{l}</button>
        ))}
      </div>
      {custom && (
        <div className="flex items-center gap-1">
          <input type="date" className="input w-auto py-1.5 text-xs" value={f} onChange={(e) => setF(e.target.value)} />
          <span className="text-xs text-fleet-muted">–</span>
          <input type="date" className="input w-auto py-1.5 text-xs" value={t} onChange={(e) => setT(e.target.value)} />
          <button className="btn btn-sm" disabled={!f || !t} onClick={() => go('custom', { from: f, to: t })}>Go</button>
        </div>
      )}
    </div>
  );
}

export function RealisedToggle({ mode }: { mode: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const set = (m: string) => { const p = new URLSearchParams(params.toString()); p.set('mode', m); router.push(`?${p.toString()}`); };
  return (
    <div className="flex rounded-fleet border border-fleet-border bg-fleet-input p-0.5">
      {[['realised', 'Realised'], ['unrealised', 'Unrealised']].map(([k, l]) => (
        <button key={k} onClick={() => set(k)} className={`rounded-[6px] px-2.5 py-1 text-xs font-medium ${mode === k ? 'bg-fleet-surface shadow-fleet-card' : 'text-fleet-muted'}`}>{l}</button>
      ))}
    </div>
  );
}
