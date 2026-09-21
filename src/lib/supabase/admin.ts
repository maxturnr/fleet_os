import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Service-role client — server only. Used for Storage uploads to the shared
// "invoices" bucket (same as the DMS does) and for nothing that bypasses
// dealership scoping without an explicit membership check first.
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  cached = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return cached;
}
