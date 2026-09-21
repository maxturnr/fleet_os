import { requireAuth } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  return (
    <AppShell
      user={{ name: auth.fullName, email: auth.email, role: auth.role }}
      dealership={{ id: auth.dealership.id, name: auth.dealership.trading_name || auth.dealership.company_name || 'Dealership' }}
      dealerships={auth.dealerships.map((d) => ({ id: d.id, name: d.trading_name || d.company_name || 'Dealership' }))}
      dmsUrl={process.env.NEXT_PUBLIC_DMS_URL || 'https://app.pitchdms.com'}
    >
      {children}
    </AppShell>
  );
}
