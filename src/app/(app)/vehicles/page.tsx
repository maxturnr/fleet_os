import { requireAuth } from '@/lib/auth';
import { listVehicles, type VehicleFilter } from '@/lib/data/finance';
import { money } from '@/lib/format';
import { PageHeader } from '@/components/AppShell';
import { VehicleTable } from '@/components/VehicleTable';

export const metadata = { title: 'Vehicles' };

export default async function VehiclesPage({ searchParams }: { searchParams: { view?: string; from?: string; to?: string; q?: string } }) {
  const auth = await requireAuth();
  const view = (['in_stock', 'sold', 'all'].includes(searchParams.view || '') ? searchParams.view : 'in_stock') as VehicleFilter;
  const rows = await listVehicles(auth.dealership.id, view, { from: searchParams.from, to: searchParams.to });
  const q = (searchParams.q || '').trim().toLowerCase();
  const filtered = q ? rows.filter((r) => [r.registration, r.make, r.model, r.stock_id].some((s) => (s || '').toLowerCase().includes(q))) : rows;

  const totals = filtered.reduce(
    (t, r) => ({
      stand_in: t.stand_in + (r.is_sold ? 0 : r.stand_in_cost),
      projected: t.projected + (r.projected_profit || 0),
      realised: t.realised + (r.realised_profit || 0),
    }),
    { stand_in: 0, projected: 0, realised: 0 },
  );

  return (
    <>
      <PageHeader
        title="Vehicles"
        subtitle={
          view === 'sold'
            ? `${filtered.length} sold · realised ${money(totals.realised)}`
            : view === 'in_stock'
              ? `${filtered.length} in stock · ${money(totals.stand_in)} stand-in · ${money(totals.projected)} projected margin`
              : `${filtered.length} vehicles`
        }
      />
      <VehicleTable rows={filtered} view={view} from={searchParams.from} to={searchParams.to} q={searchParams.q} />
    </>
  );
}
