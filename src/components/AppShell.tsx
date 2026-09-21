'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { Activity, Car, Camera, ExternalLink, LayoutDashboard, LogOut, MessageSquare, Receipt, Sparkles } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { signOut, switchDealership } from '@/lib/actions';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vehicles', label: 'Vehicles', icon: Car },
  { href: '/receipts', label: 'Snap receipt', icon: Camera },
  { href: '/assistant', label: 'Ask AI', icon: Sparkles },
  { href: '/tax', label: 'Tax & export', icon: Receipt },
  { href: '/activity', label: 'Activity', icon: Activity },
];

const MOBILE = ['/dashboard', '/vehicles', '/receipts', '/assistant', '/tax'];

export function AppShell({ children, user, dealership, dealerships, dmsUrl }: {
  children: React.ReactNode;
  user: { name: string; email: string | null; role: string };
  dealership: { id: string; name: string };
  dealerships: { id: string; name: string }[];
  dmsUrl: string;
}) {
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-fleet-border bg-fleet-sidebar p-4 md:flex">
        <div className="mb-6 px-1"><Logo /></div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`nav-link ${isActive(href) ? 'nav-link-active' : ''}`}>
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <a href={dmsUrl} target="_blank" rel="noreferrer" className="nav-link text-xs">
            <ExternalLink className="h-3.5 w-3.5" /> Open Pitch DMS
          </a>
          <div className="rounded-fleet-lg border border-fleet-border bg-fleet-surface p-3">
            {dealerships.length > 1 ? (
              <select
                className="input mb-2 py-1.5 text-xs"
                value={dealership.id}
                disabled={pending}
                onChange={(e) => start(() => switchDealership(e.target.value))}
              >
                {dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            ) : (
              <p className="mb-1 truncate text-sm font-semibold">{dealership.name}</p>
            )}
            <p className="truncate text-xs text-fleet-muted">{user.name}</p>
            <p className="mb-2 text-[11px] capitalize text-fleet-faint">{user.role}</p>
            <button className="btn btn-sm w-full" onClick={() => start(() => signOut())} disabled={pending}>
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-fleet-border bg-fleet-bg/90 px-4 py-3 backdrop-blur md:hidden">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <span className="max-w-[40vw] truncate text-xs text-fleet-muted">{dealership.name}</span>
            <Link href="/activity" className="btn btn-sm"><Activity className="h-3.5 w-3.5" /></Link>
            <button className="btn btn-sm" onClick={() => start(() => signOut())} aria-label="Sign out"><LogOut className="h-3.5 w-3.5" /></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 sm:px-6 sm:pt-6 md:pb-10">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-fleet-border bg-fleet-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {NAV.filter((n) => MOBILE.includes(n.href)).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`flex flex-col items-center gap-1 py-2 text-[10px] font-medium ${isActive(href) ? 'text-fleet-text' : 'text-fleet-faint'}`}>
              <Icon className="h-5 w-5" strokeWidth={isActive(href) ? 2.25 : 1.75} />
              {label === 'Snap receipt' ? 'Receipt' : label === 'Tax & export' ? 'Tax' : label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-fleet-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyIcon() { return <MessageSquare className="h-5 w-5 text-fleet-faint" />; }
