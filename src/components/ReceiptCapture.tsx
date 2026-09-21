'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Camera, CheckCircle2, FileText, Loader2, Upload } from 'lucide-react';
import { uploadReceipt } from '@/lib/actions';
import { ago, money } from '@/lib/format';
import { CostForm, type Extracted, type VehicleOption } from '@/components/CostForm';

type Stage = 'idle' | 'uploading' | 'reading' | 'confirm';

export function ReceiptCapture({ vehicles, recent }: {
  vehicles: VehicleOption[];
  recent: { id: string; vehicle_id: string; label: string; supplier: string | null; amount: number; invoice_url: string | null; created_at: string }[];
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ url: string } | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [saved, setSaved] = useState(0);

  async function handle(file: File) {
    setError(null);
    setStage('uploading');
    const fd = new FormData();
    fd.append('file', file);
    const up = await uploadReceipt(fd);
    if (!up.ok) { setError(up.error); setStage('idle'); return; }
    setReceipt({ url: up.url });
    setStage('reading');
    try {
      const res = await fetch('/api/receipts/extract', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: up.url }) });
      const j = await res.json();
      setExtracted(res.ok ? j.extracted : null);
      if (!res.ok) setError(`AI couldn't read this one (${j.error || res.status}) — fill it in manually.`);
    } catch {
      setExtracted(null);
      setError("AI couldn't read this one — fill it in manually.");
    }
    setStage('confirm');
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ''; };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="card card-pad">
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onPick} />
          {stage === 'idle' || stage === 'confirm' ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="btn-primary flex-1 py-6 text-base" onClick={() => camRef.current?.click()}><Camera className="h-5 w-5" /> Take photo</button>
              <button className="btn flex-1 py-6 text-base" onClick={() => fileRef.current?.click()}><Upload className="h-5 w-5" /> Choose file / PDF</button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 py-8 text-sm text-fleet-muted">
              <Loader2 className="h-5 w-5 animate-spin" /> {stage === 'uploading' ? 'Uploading receipt…' : 'Reading amount, date and supplier…'}
            </div>
          )}
          {saved > 0 && <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-fleet-green"><CheckCircle2 className="h-4 w-4" /> {saved} receipt{saved > 1 ? 's' : ''} filed this session.</p>}
          {error && <p className="mt-3 rounded-fleet bg-fleet-amber-dim px-3 py-2 text-sm text-fleet-amber">{error}</p>}
          <ol className="mt-5 grid gap-2 text-xs text-fleet-muted sm:grid-cols-3">
            <li className="rounded-fleet bg-fleet-input px-3 py-2"><b className="text-fleet-text">1.</b> Photo or PDF of the receipt</li>
            <li className="rounded-fleet bg-fleet-input px-3 py-2"><b className="text-fleet-text">2.</b> AI pre-fills amount, date, supplier &amp; type</li>
            <li className="rounded-fleet bg-fleet-input px-3 py-2"><b className="text-fleet-text">3.</b> Pick the car, confirm — it&apos;s in the DMS</li>
          </ol>
        </div>
      </div>

      <div className="lg:col-span-2">
        <h2 className="mb-2 text-sm font-semibold">Recently filed</h2>
        <ul className="card divide-y divide-fleet-border">
          {recent.length === 0 && <li className="px-4 py-6 text-center text-sm text-fleet-faint">Nothing yet.</li>}
          {recent.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              {r.invoice_url ? <a href={r.invoice_url} target="_blank" rel="noreferrer" className="text-fleet-blue"><FileText className="h-4 w-4" /></a> : <FileText className="h-4 w-4 text-fleet-faint" />}
              <div className="min-w-0 flex-1">
                <Link href={`/vehicles/${r.vehicle_id}`} className="block truncate font-medium capitalize hover:underline">{r.label}</Link>
                <p className="truncate text-xs text-fleet-muted">{r.supplier || '—'} · {ago(r.created_at)}</p>
              </div>
              <span className="tabular">{money(r.amount, { pennies: true })}</span>
            </li>
          ))}
        </ul>
      </div>

      {stage === 'confirm' && receipt && (
        <CostForm
          vehicles={vehicles}
          initial={extracted}
          initialReceipt={receipt}
          onClose={() => { setStage('idle'); setReceipt(null); setExtracted(null); }}
          afterSave={() => setSaved((n) => n + 1)}
        />
      )}
    </div>
  );
}
