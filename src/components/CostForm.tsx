'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Plus, Sparkles, X } from 'lucide-react';
import type { CostLine } from '@/lib/types';
import { COST_TYPES, VAT_TYPES } from '@/lib/types';
import { addCost, updateCost, uploadReceipt } from '@/lib/actions';
import { toISODate } from '@/lib/format';

export interface VehicleOption { vehicle_id: string; label: string; registration: string | null; is_sold: boolean }

export interface Extracted {
  amount?: number | null; date?: string | null; supplier?: string | null; description?: string | null;
  cost_type?: string | null; vat_type?: string | null; registration?: string | null; confidence?: string;
}

export function AddCostButton({ vehicleId, vehicleLabel }: { vehicleId: string; vehicleLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary btn-sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Add cost</button>
      {open && <CostForm vehicleId={vehicleId} vehicleLabel={vehicleLabel} onClose={() => setOpen(false)} />}
    </>
  );
}

export function CostForm({ vehicleId, vehicleLabel, existing, onClose, initial, initialReceipt, vehicles, afterSave }: {
  vehicleId?: string;
  vehicleLabel?: string;
  existing?: CostLine;
  onClose: () => void;
  initial?: Extracted | null;
  initialReceipt?: { url: string } | null;
  vehicles?: VehicleOption[];
  afterSave?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(existing?.invoice_url || initialReceipt?.url || null);
  const [selectedVehicle, setSelectedVehicle] = useState(vehicleId || '');
  const [form, setForm] = useState({
    cost_date: existing?.cost_date || initial?.date || toISODate(new Date()),
    cost_type: existing?.cost_type || initial?.cost_type || 'parts',
    cost_type_other: existing?.cost_type_other || '',
    amount: existing ? String(existing.amount) : initial?.amount != null ? String(initial.amount) : '',
    vat_type: existing?.vat_type || initial?.vat_type || 'included',
    supplier: existing?.supplier || initial?.supplier || '',
    description: existing?.description || initial?.description || '',
    payment_status: existing?.payment_status || '',
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (initial?.registration && vehicles && !selectedVehicle) {
      const m = vehicles.find((v) => (v.registration || '').replace(/\s/g, '').toUpperCase() === initial.registration!.replace(/\s/g, '').toUpperCase());
      if (m) setSelectedVehicle(m.vehicle_id);
    }
  }, [initial, vehicles, selectedVehicle]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const r = await uploadReceipt(fd);
    setUploading(false);
    if (!r.ok) return setError(r.error);
    setReceiptUrl(r.url);
  }

  async function extract() {
    if (!receiptUrl) return;
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch('/api/receipts/extract', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: receiptUrl }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Extraction failed');
      const x: Extracted = j.extracted || {};
      setForm((f) => ({
        ...f,
        amount: x.amount != null ? String(x.amount) : f.amount,
        cost_date: x.date || f.cost_date,
        supplier: x.supplier || f.supplier,
        description: x.description || f.description,
        cost_type: x.cost_type && (COST_TYPES as readonly string[]).includes(x.cost_type) ? x.cost_type : f.cost_type,
        vat_type: x.vat_type || f.vat_type,
      }));
      if (x.registration && vehicles && !selectedVehicle) {
        const m = vehicles.find((v) => (v.registration || '').replace(/\s/g, '').toUpperCase() === x.registration!.replace(/\s/g, '').toUpperCase());
        if (m) setSelectedVehicle(m.vehicle_id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExtracting(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return setError('Enter a positive amount.');
    const vid = vehicleId || selectedVehicle;
    if (!vid) return setError('Choose which vehicle this cost belongs to.');
    setError(null);
    start(async () => {
      const payload = {
        vehicle_id: vid,
        cost_date: form.cost_date,
        cost_type: form.cost_type,
        cost_type_other: form.cost_type_other || null,
        amount,
        vat_type: form.vat_type,
        supplier: form.supplier || null,
        description: form.description || null,
        invoice_url: receiptUrl,
        payment_status: form.payment_status || null,
      };
      const r = existing ? await updateCost(existing.cost_id, payload) : await addCost(payload);
      if (!r.ok) return setError(r.error);
      onClose();
      afterSave?.();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 sm:rounded-b-fleet-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">{existing ? 'Edit cost' : 'Add cost'}</h2>
            {vehicleLabel && <p className="text-xs text-fleet-muted">{vehicleLabel}</p>}
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose}><X className="h-3.5 w-3.5" /></button>
        </div>

        <div className="space-y-3">
          {/* Receipt */}
          <div className="rounded-fleet-lg border border-dashed border-fleet-border-strong p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={onFile} />
              <button type="button" className="btn btn-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} {receiptUrl ? 'Replace receipt' : 'Snap / upload receipt'}
              </button>
              {receiptUrl && (
                <button type="button" className="btn btn-sm" disabled={extracting} onClick={extract}>
                  {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Read with AI
                </button>
              )}
              {receiptUrl && <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-fleet-blue underline">view</a>}
            </div>
            {receiptUrl && /\.(jpe?g|png|webp|heic)$/i.test(receiptUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={receiptUrl} alt="Receipt" className="mt-2 max-h-40 rounded-fleet object-contain" />
            )}
          </div>

          {!vehicleId && vehicles && (
            <label className="block space-y-1">
              <span className="label">Vehicle</span>
              <select className="input" value={selectedVehicle} onChange={(e) => setSelectedVehicle(e.target.value)} required>
                <option value="">Choose a vehicle…</option>
                <optgroup label="In stock">
                  {vehicles.filter((v) => !v.is_sold).map((v) => <option key={v.vehicle_id} value={v.vehicle_id}>{v.label}</option>)}
                </optgroup>
                <optgroup label="Sold">
                  {vehicles.filter((v) => v.is_sold).map((v) => <option key={v.vehicle_id} value={v.vehicle_id}>{v.label}</option>)}
                </optgroup>
              </select>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="label">Amount (£)</span>
              <input className="input tabular" inputMode="decimal" type="number" step="0.01" min="0.01" required value={form.amount} onChange={set('amount')} />
            </label>
            <label className="block space-y-1">
              <span className="label">Date</span>
              <input className="input" type="date" required value={form.cost_date} onChange={set('cost_date')} />
            </label>
            <label className="block space-y-1">
              <span className="label">Type</span>
              <select className="input capitalize" value={form.cost_type} onChange={set('cost_type')}>
                {COST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="label">VAT</span>
              <select className="input" value={form.vat_type} onChange={set('vat_type')}>
                {VAT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
          </div>
          {form.cost_type === 'other' && (
            <label className="block space-y-1">
              <span className="label">What kind of cost?</span>
              <input className="input" value={form.cost_type_other} onChange={set('cost_type_other')} placeholder="e.g. valeting" />
            </label>
          )}
          <label className="block space-y-1">
            <span className="label">Supplier</span>
            <input className="input" value={form.supplier} onChange={set('supplier')} placeholder="e.g. Euro Car Parts" />
          </label>
          <label className="block space-y-1">
            <span className="label">Description / note</span>
            <textarea className="input" rows={2} value={form.description} onChange={set('description')} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.payment_status === 'credit'} onChange={(e) => setForm((f) => ({ ...f, payment_status: e.target.checked ? 'credit' : '' }))} />
            Not paid yet (on credit / 30 days)
          </label>
          {error && <p className="rounded-fleet bg-fleet-red-dim px-3 py-2 text-sm text-fleet-red">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={pending || uploading}>{pending ? 'Saving…' : existing ? 'Save changes' : 'Add cost'}</button>
        </div>
        <p className="mt-3 text-[11px] text-fleet-faint">Written straight into Pitch DMS (vehicle cost + expense), so it shows up there immediately.</p>
      </form>
    </div>
  );
}
