import { canWrite, requireAuth } from '@/lib/auth';
import { listRecentCosts, listVehicles } from '@/lib/data/finance';
import { vehicleTitle } from '@/lib/format';
import { PageHeader } from '@/components/AppShell';
import { ReceiptCapture } from '@/components/ReceiptCapture';
import { Warn } from '@/components/ui';

export const metadata = { title: 'Snap receipt' };

export default async function ReceiptsPage() {
  const auth = await requireAuth();
  const [vehicles, recent] = await Promise.all([listVehicles(auth.dealership.id, 'all'), listRecentCosts(auth.dealership.id, 12)]);
  const options = vehicles.map((v) => ({
    vehicle_id: v.vehicle_id,
    registration: v.registration,
    is_sold: v.is_sold,
    label: `${v.registration || '—'} · ${vehicleTitle(v)}${v.is_sold ? ' (sold)' : ''}`,
  }));

  return (
    <>
      <PageHeader title="Snap a receipt" subtitle="Photo → AI reads it → you confirm the car → it's in the DMS. Aim for under 30 seconds." />
      {!canWrite(auth.role) ? (
        <Warn>Your role is read-only, so you can view but not add costs.</Warn>
      ) : (
        <ReceiptCapture vehicles={options} recent={recent.map((c) => ({ id: c.cost_id, vehicle_id: c.vehicle_id, label: `${c.registration || ''} ${c.cost_type}`, supplier: c.supplier, amount: c.amount, invoice_url: c.invoice_url, created_at: c.created_at }))} />
      )}
    </>
  );
}
