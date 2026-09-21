'use client';

import { useState, useTransition } from 'react';
import { FileText, Pencil, Trash2 } from 'lucide-react';
import type { CostLine } from '@/lib/types';
import { deleteCost } from '@/lib/actions';
import { dateShort, money } from '@/lib/format';
import { CostForm } from '@/components/CostForm';

export function CostList({ costs, vehicleId, writable }: { costs: CostLine[]; vehicleId: string; writable: boolean }) {
  const [editing, setEditing] = useState<CostLine | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const byType = costs.reduce<Record<string, number>>((m, c) => ({ ...m, [c.cost_type]: (m[c.cost_type] || 0) + c.amount }), {});

  return (
    <div className="space-y-3">
      {Object.keys(byType).length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, a]) => (
            <span key={t} className="chip bg-fleet-input capitalize text-fleet-text-secondary">{t} · {money(a)}</span>
          ))}
        </div>
      )}
      {error && <p className="rounded-fleet bg-fleet-red-dim px-3 py-2 text-xs text-fleet-red">{error}</p>}
      <div className="card divide-y divide-fleet-border">
        {costs.length === 0 && <p className="px-4 py-8 text-center text-sm text-fleet-faint">No costs yet.</p>}
        {costs.map((c) => (
          <div key={c.cost_id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium capitalize">{c.cost_type === 'other' && c.cost_type_other ? c.cost_type_other : c.cost_type}</span>
                {c.supplier && <span className="text-sm text-fleet-text-secondary">· {c.supplier}</span>}
                {c.payment_status === 'credit' && <span className="chip bg-fleet-amber-dim text-fleet-amber">unpaid</span>}
              </div>
              {c.description && <p className="mt-0.5 truncate text-xs text-fleet-muted">{c.description}</p>}
              <p className="mt-0.5 text-[11px] text-fleet-faint">
                {dateShort(c.cost_date)}{c.created_by_name ? ` · ${c.created_by_name}` : ''}{c.vat_type === 'included' ? ` · inc. ${money(c.vat_amount, { pennies: true })} VAT` : c.vat_type === 'none' ? ' · no VAT' : ''}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {c.invoice_url && (
                <a href={c.invoice_url} target="_blank" rel="noreferrer" className="btn btn-sm" title="View receipt"><FileText className="h-3.5 w-3.5" /></a>
              )}
              <span className="tabular w-20 text-right text-sm font-medium">{money(c.amount, { pennies: true })}</span>
              {writable && (
                <>
                  <button className="btn btn-sm" onClick={() => setEditing(c)} title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                  <button
                    className="btn btn-sm text-fleet-red"
                    disabled={pending}
                    title="Delete"
                    onClick={() => {
                      if (!confirm(`Delete this ${money(c.amount)} ${c.cost_type} cost? This removes it from Pitch DMS too.`)) return;
                      start(async () => {
                        const r = await deleteCost(c.cost_id, vehicleId);
                        if (!r.ok) setError(r.error);
                      });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {editing && <CostForm vehicleId={vehicleId} existing={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
