'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { saveAllocations } from '@/lib/actions';
import { money } from '@/lib/format';
import { ALLOC_CATEGORIES, OVERHEAD_CATEGORIES, VAT_STATUSES } from '@/lib/types';
import type { QbAllocation, QbTransaction } from '@/lib/types';

type Vehicle = { vehicle_id: string; registration: string; make: string | null; model: string | null; is_sold: boolean };

interface Row {
  key: string;
  amount: string;
  vehicle_id: string;
  is_overhead: boolean;
  category: string;
  vat_status: string;
  vat_amount: string;
  notes: string;
}

const uid = () => Math.random().toString(36).slice(2);

const toRow = (a: QbAllocation): Row => ({
  key: a.id,
  amount: String(a.amount ?? ''),
  vehicle_id: a.vehicle_id || '',
  is_overhead: !!a.is_overhead,
  category: a.category || '',
  vat_status: a.vat_status || 'unknown',
  vat_amount: a.vat_amount === null || a.vat_amount === undefined ? '' : String(a.vat_amount),
  notes: a.notes || '',
});

const blank = (amount: number | string = ''): Row => ({
  key: uid(), amount: String(amount), vehicle_id: '', is_overhead: false,
  category: '', vat_status: 'unknown', vat_amount: '', notes: '',
});

export default function AllocationEditor({
  txn, splits, vehicles, canWrite,
}: { txn: QbTransaction; splits: QbAllocation[]; vehicles: Vehicle[]; canWrite: boolean }) {
  const gross = Math.abs(txn.amount || 0);
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => (splits.length ? splits.map(toRow) : [blank(gross.toFixed(2))]));
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);
  const left = Math.round((gross - total) * 100) / 100;

  const patch = (key: string, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const splitEvenly = () => {
    const n = rows.length || 1;
    const each = Math.floor((gross / n) * 100) / 100;
    const last = Math.round((gross - each * (n - 1)) * 100) / 100;
    setRows((rs) => rs.map((r, i) => ({ ...r, amount: (i === n - 1 ? last : each).toFixed(2) })));
  };

  const vatAt20 = (key: string) => {
    const r = rows.find((x) => x.key === key);
    if (!r) return;
    const amt = Number(r.amount) || 0;
    patch(key, { vat_status: 'standard', vat_amount: (Math.round((amt / 6) * 100) / 100).toFixed(2) });
  };

  const submit = () => {
    setErr(null); setSaved(false);
    start(async () => {
      const res = await saveAllocations(txn.id, rows.map((r) => ({
        amount: Number(r.amount) || 0,
        vehicle_id: r.vehicle_id || null,
        is_overhead: r.is_overhead,
        category: r.category || null,
        vat_status: r.vat_status,
        vat_amount: r.vat_amount === '' ? null : Number(r.vat_amount),
        notes: r.notes || null,
      })));
      if (!res.ok) { setErr(res.error); return; }
      setSaved(true);
      router.refresh();
    });
  };

  const inStock = vehicles.filter((v) => !v.is_sold);
  const sold = vehicles.filter((v) => v.is_sold);

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Split this payment</h2>
        <p className="text-xs text-fleet-faint">
          {money(total, { pennies: true })} of {money(gross, { pennies: true })} allocated
          {left > 0.005 && <span className="text-fleet-amber"> · {money(left, { pennies: true })} left</span>}
          {left < -0.005 && <span className="text-fleet-red"> · {money(-left, { pennies: true })} over</span>}
          {Math.abs(left) <= 0.005 && <span className="text-fleet-green"> · balanced</span>}
        </p>
      </div>

      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-fleet-border">
        <div
          className={`h-full rounded-full ${left < -0.005 ? 'bg-fleet-red' : Math.abs(left) <= 0.005 ? 'bg-fleet-green' : 'bg-fleet-amber'}`}
          style={{ width: `${Math.min(100, gross ? (total / gross) * 100 : 0)}%` }}
        />
      </div>

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.key} className="rounded-lg border border-fleet-border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-fleet-faint">Part {i + 1}</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-fleet-text-secondary">
                  <input
                    type="checkbox" className="accent-fleet-blue" checked={r.is_overhead}
                    onChange={(e) => patch(r.key, { is_overhead: e.target.checked, vehicle_id: e.target.checked ? '' : r.vehicle_id, category: '' })}
                  />
                  Overhead (not a car)
                </label>
                {rows.length > 1 && (
                  <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    className="text-fleet-faint hover:text-fleet-red" aria-label="Remove part">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="label">Amount</span>
                <input type="number" step="0.01" min="0" value={r.amount} className="input tabular"
                  onChange={(e) => patch(r.key, { amount: e.target.value })} />
              </label>

              {r.is_overhead ? (
                <label className="block">
                  <span className="label">Overhead type</span>
                  <select value={r.category} className="input" onChange={(e) => patch(r.key, { category: e.target.value })}>
                    <option value="">Choose…</option>
                    {OVERHEAD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              ) : (
                <>
                  <label className="block">
                    <span className="label">Car</span>
                    <select value={r.vehicle_id} className="input" onChange={(e) => patch(r.key, { vehicle_id: e.target.value })}>
                      <option value="">Choose a car…</option>
                      {inStock.length > 0 && (
                        <optgroup label="In stock">
                          {inStock.map((v) => <option key={v.vehicle_id} value={v.vehicle_id}>{v.registration} — {v.make} {v.model}</option>)}
                        </optgroup>
                      )}
                      {sold.length > 0 && (
                        <optgroup label="Sold">
                          {sold.map((v) => <option key={v.vehicle_id} value={v.vehicle_id}>{v.registration} — {v.make} {v.model}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Cost type</span>
                    <select value={r.category} className="input" onChange={(e) => patch(r.key, { category: e.target.value })}>
                      <option value="">Choose…</option>
                      {ALLOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </>
              )}

              <label className="block">
                <span className="label">VAT</span>
                <select value={r.vat_status} className="input" onChange={(e) => patch(r.key, { vat_status: e.target.value })}>
                  {VAT_STATUSES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="label">
                  VAT amount
                  <button type="button" onClick={() => vatAt20(r.key)} className="ml-2 text-fleet-blue hover:underline">20%</button>
                </span>
                <input type="number" step="0.01" min="0" value={r.vat_amount} placeholder="—" className="input tabular"
                  onChange={(e) => patch(r.key, { vat_amount: e.target.value })} />
              </label>

              <label className="block sm:col-span-2 lg:col-span-3">
                <span className="label">Note</span>
                <input value={r.notes} placeholder="What this part of the payment was for" className="input"
                  onChange={(e) => patch(r.key, { notes: e.target.value })} />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setRows((rs) => [...rs, blank(Math.max(left, 0).toFixed(2))])}
          className="btn-ghost text-xs"><Plus className="h-3.5 w-3.5" /> Add another part</button>
        {rows.length > 1 && (
          <button type="button" onClick={splitEvenly} className="btn-ghost text-xs">
            <Wand2 className="h-3.5 w-3.5" /> Split evenly
          </button>
        )}
        <div className="flex-1" />
        {err && <p className="text-xs text-fleet-red">{err}</p>}
        {saved && !err && <p className="text-xs text-fleet-green">Saved.</p>}
        <button type="button" onClick={submit} disabled={pending || !canWrite} className="btn-primary text-xs">
          {pending ? 'Saving…' : 'Save allocation'}
        </button>
      </div>
      {!canWrite && <p className="mt-2 text-xs text-fleet-faint">Your role is read-only.</p>}
    </div>
  );
}
