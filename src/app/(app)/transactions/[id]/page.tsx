import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { canWrite, requireAuth } from '@/lib/auth';
import { getTransaction, listVehiclePicker } from '@/lib/data/finance';
import { dateShort, money } from '@/lib/format';
import AllocationEditor from '@/components/AllocationEditor';

export const metadata = { title: 'Transaction' };

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  const [found, vehicles] = await Promise.all([getTransaction(id), listVehiclePicker(auth.dealership.id)]);
  if (!found) notFound();
  const { txn, splits } = found;

  const facts: [string, React.ReactNode][] = [
    ['Date', dateShort(txn.txn_date)],
    ['Type', txn.txn_type || '—'],
    ['Paid from', txn.account || '—'],
    ['QuickBooks category', txn.category || '—'],
    ['Amount', <span key="amt" className={txn.money_in ? 'text-fleet-green' : ''}>{txn.money_in ? money(txn.money_in, { pennies: true }) : `−${money(txn.spend, { pennies: true })}`}</span>],
  ];

  return (
    <>
      <Link href="/transactions" className="mb-3 inline-flex items-center gap-1.5 text-xs text-fleet-text-secondary hover:text-fleet-text">
        <ArrowLeft className="h-3.5 w-3.5" /> All transactions
      </Link>

      <div className="card card-pad mb-4">
        <h1 className="text-lg font-semibold">{txn.name || txn.memo || txn.account || 'Payment'}</h1>
        {txn.memo && <p className="mt-0.5 text-sm text-fleet-text-secondary">{txn.memo}</p>}
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="label">{k}</dt>
              <dd className="tabular mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
        {txn.memo && /[A-Z]{2}\d{2}\s?[A-Z]{3}|[A-Z]\d{1,3}\s?[A-Z]{3}/.test(txn.memo.toUpperCase()) && (
          <p className="mt-3 text-xs text-fleet-faint">
            The memo looks like it carries a registration — worth checking it matches the car you pick.
          </p>
        )}
      </div>

      <AllocationEditor txn={txn} splits={splits} vehicles={vehicles} canWrite={canWrite(auth.role)} />
    </>
  );
}
