'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { TaxAssumptions } from '@/lib/types';
import { saveTaxAssumptions } from '@/lib/actions';

export function TaxAssumptionsForm({ assumptions, writable }: { assumptions: TaxAssumptions; writable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [corp, setCorp] = useState(String(Math.round(assumptions.corp_tax_rate * 10000) / 100));
  const [vat, setVat] = useState(String(Math.round(assumptions.vat_rate * 10000) / 100));
  const [qs, setQs] = useState(assumptions.vat_quarter_start || '');
  const [notes, setNotes] = useState(assumptions.notes || '');
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="card card-pad"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveTaxAssumptions({ corp_tax_rate: Number(corp) / 100, vat_rate: Number(vat) / 100, vat_quarter_start: qs || null, notes: notes || null });
          setMsg(r.ok ? 'Saved.' : r.error);
          if (r.ok) router.refresh();
        });
      }}
    >
      <h2 className="mb-1 text-sm font-semibold">Assumptions</h2>
      <p className="mb-3 text-xs text-fleet-muted">Editable — the estimates above use these. UK small profits rate is 19% (profits under £50k), main rate 25% (over £250k), marginal relief in between.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1"><span className="label">Corporation tax %</span><input className="input tabular" type="number" step="0.5" min="0" max="100" value={corp} onChange={(e) => setCorp(e.target.value)} disabled={!writable} /></label>
        <label className="block space-y-1"><span className="label">VAT rate %</span><input className="input tabular" type="number" step="0.5" min="0" max="100" value={vat} onChange={(e) => setVat(e.target.value)} disabled={!writable} /></label>
        <label className="col-span-2 block space-y-1"><span className="label">VAT quarter starts</span><input className="input" type="date" value={qs} onChange={(e) => setQs(e.target.value)} disabled={!writable} /></label>
        <label className="col-span-2 block space-y-1"><span className="label">Notes for the accountant</span><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!writable} /></label>
      </div>
      {writable && <div className="mt-3 flex items-center gap-3"><button className="btn-primary btn-sm" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>{msg && <span className="text-xs text-fleet-muted">{msg}</span>}</div>}
    </form>
  );
}
