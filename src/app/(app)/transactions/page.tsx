import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { getAllocProgress, listTransactions, type TxnFilter } from '@/lib/data/finance';
import { dateShort, money } from '@/lib/format';
import { PageHeader } from '@/components/AppShell';
import { Stat } from '@/components/ui';
import TransactionFilters from '@/components/TransactionFilters';

export const metadata = { title: 'Transactions' };

const FILTERS: TxnFilter[] = ['todo', 'done', 'vehicle', 'overhead', 'money_in', 'all'];

const STATUS_CHIP: Record<string, string> = {
  todo: 'bg-fleet-amber-dim text-fleet-amber',
  partial: 'bg-fleet-amber-dim text-fleet-amber',
  done: 'bg-fleet-green-dim text-fleet-green',
  not_spend: 'bg-fleet-blue-dim text-fleet-blue',
};

export default async function TransactionsPage({
  searchParams,
}: { searchParams: Promise<{ filter?: string; from?: string; to?: string; q?: string }> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const filter = (FILTERS.includes(sp.filter as TxnFilter) ? sp.filter : 'todo') as TxnFilter;

  const [progress, rows] = await Promise.all([
    getAllocProgress(auth.dealership.id),
    listTransactions(auth.dealership.id, filter, { from: sp.from, to: sp.to, q: sp.q }),
  ]);

  const pct = progress.spend ? (progress.done_value / progress.spend) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Every payment out of the bank, straight from QuickBooks. Put each one on a car — or on overheads — and the per-car profit takes care of itself."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Spend imported" value={money(progress.spend)} sub={`${progress.rows} payments`} />
        <Stat label="Allocated" value={money(progress.done_value)} sub={`${Math.round(pct)}% · ${progress.done_rows} payments`} tone="pos" />
        <Stat label="Still to do" value={money(progress.todo_value)} sub={`${progress.todo_rows} payments`} tone={progress.todo_rows ? 'neg' : 'pos'} />
        <Stat label="On cars / overheads" value={`${money(progress.vehicle_value)} / ${money(progress.overhead_value)}`} />
      </div>

      <TransactionFilters filter={filter} from={sp.from} to={sp.to} q={sp.q} />

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[6rem_1fr_9rem_7rem_6rem_1.5rem] gap-3 border-b border-fleet-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-fleet-label md:grid">
          <span>Date</span><span>Payee / memo</span><span>Category</span><span className="text-right">Amount</span><span>Status</span><span />
        </div>
        <ul className="divide-y divide-fleet-border">
          {rows.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-fleet-faint">
              {filter === 'todo' ? 'Nothing left to allocate. Nice.' : 'No transactions match those filters.'}
            </li>
          )}
          {rows.map((t) => (
            <li key={t.id}>
              <Link href={`/transactions/${t.id}`} className="grid gap-1 px-4 py-3 text-sm hover:bg-fleet-input md:grid-cols-[6rem_1fr_9rem_7rem_6rem_1.5rem] md:items-center md:gap-3">
                <span className="text-fleet-text-secondary">{dateShort(t.txn_date)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.name || t.memo || t.account || t.txn_type || 'Payment'}</span>
                  {(t.memo && t.name) && <span className="block truncate text-[11px] text-fleet-faint">{t.memo}</span>}
                  {t.registrations && <span className="block truncate text-[11px] text-fleet-blue">{t.registrations}</span>}
                </span>
                <span className="truncate text-[11px] text-fleet-text-secondary">{t.category || '—'}</span>
                <span className={`tabular md:text-right ${t.money_in ? 'text-fleet-green' : ''}`}>
                  {t.money_in ? money(t.money_in, { pennies: true }) : `−${money(t.spend, { pennies: true })}`}
                </span>
                <span>
                  <span className={`chip ${STATUS_CHIP[t.alloc_status] || ''}`}>
                    {t.alloc_status === 'done' ? (t.split_count > 1 ? `${t.split_count} splits` : 'Done')
                      : t.alloc_status === 'partial' ? `${money(t.unallocated)} left`
                      : t.alloc_status === 'not_spend' ? t.txn_type
                      : 'To do'}
                  </span>
                </span>
                <ChevronRight className="hidden h-4 w-4 text-fleet-faint md:block" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {rows.length >= 300 && (
        <p className="mt-2 text-xs text-fleet-faint">Showing the most recent 300. Narrow the dates to see further back.</p>
      )}
    </>
  );
}
