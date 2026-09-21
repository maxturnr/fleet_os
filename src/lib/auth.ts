import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type Role = 'owner' | 'manager' | 'sales' | 'viewer';

export interface Dealership {
  id: string;
  trading_name: string | null;
  company_name: string | null;
  vat_registered: boolean | null;
  vat_effective_date: string | null;
  logo: string | null;
}

export interface AuthContext {
  userId: string;
  email: string | null;
  fullName: string;
  role: Role;
  dealership: Dealership;
  dealerships: Dealership[];
}

const DEALERSHIP_COOKIE = 'pm_dealership';

/**
 * Maps the DMS's role vocabulary onto Pitch Money's four roles.
 * dealership_users.role is 'admin' for everyone today; user_profiles.access_level
 * is 'Admin'. Anything else is treated as a viewer (read-only money view).
 */
export function toRole(duRole: string | null | undefined, accessLevel: string | null | undefined): Role {
  const r = (duRole || '').toLowerCase();
  const a = (accessLevel || '').toLowerCase();
  if (r === 'owner') return 'owner';
  if (r === 'admin' || a === 'admin') return 'owner';
  if (r === 'manager') return 'manager';
  if (r === 'sales' || r === 'member') return 'sales';
  return 'viewer';
}

export const canWrite = (role: Role) => role !== 'viewer';
export const canSeeTax = (role: Role) => role === 'owner' || role === 'manager';

/** Resolve the signed-in user, their dealerships and the active one (once per request). */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, duRes] = await Promise.all([
    supabase.from('user_profiles').select('first_name, last_name, access_level').eq('id', user.id).maybeSingle(),
    supabase
      .from('dealership_users')
      .select('role, dealership_id, dealerships(id, trading_name, company_name, vat_registered, vat_effective_date, logo)')
      .eq('user_id', user.id)
      .is('removed_at', null)
      .order('created_at', { ascending: true }),
  ]);

  const memberships = (duRes.data || []) as any[];
  const dealerships: Dealership[] = memberships.map((m) => m.dealerships).filter(Boolean);
  if (dealerships.length === 0) return null;

  const wanted = cookies().get(DEALERSHIP_COOKIE)?.value;
  const dealership = dealerships.find((d) => d.id === wanted) || dealerships[0];
  const membership = memberships.find((m) => m.dealership_id === dealership.id);
  const profile = profileRes.data as any;

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user.email || 'You',
    role: toRole(membership?.role, profile?.access_level),
    dealership,
    dealerships,
  };
});

/** For pages inside the protected layout: redirects instead of returning null. */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect('/login');
  return auth;
}

export { DEALERSHIP_COOKIE };
