'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { DEALERSHIP_COOKIE, canWrite, requireAuth } from '@/lib/auth';

export interface CostInput {
  vehicle_id: string;
  cost_date: string;
  cost_type: string;
  cost_type_other?: string | null;
  amount: number;
  vat_type: string;
  supplier?: string | null;
  description?: string | null;
  invoice_url?: string | null;
  payment_status?: string | null;
}

export async function addCost(input: CostInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const auth = await requireAuth();
  if (!canWrite(auth.role)) return { ok: false, error: 'Your role is read-only.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('pm_add_vehicle_cost', {
    p_vehicle_id: input.vehicle_id,
    p_cost_date: input.cost_date,
    p_cost_type: input.cost_type,
    p_amount: input.amount,
    p_vat_type: input.vat_type,
    p_supplier: input.supplier || null,
    p_description: input.description || null,
    p_cost_type_other: input.cost_type === 'other' ? input.cost_type_other || input.description || 'Other' : null,
    p_invoice_url: input.invoice_url || null,
    p_payment_status: input.payment_status || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/vehicles/${input.vehicle_id}`);
  revalidatePath('/vehicles');
  revalidatePath('/dashboard');
  revalidatePath('/activity');
  return { ok: true, id: data as string };
}

export async function updateCost(costId: string, input: Omit<CostInput, 'vehicle_id'> & { vehicle_id?: string }) {
  const auth = await requireAuth();
  if (!canWrite(auth.role)) return { ok: false as const, error: 'Your role is read-only.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('pm_update_vehicle_cost', {
    p_cost_id: costId,
    p_cost_date: input.cost_date,
    p_cost_type: input.cost_type,
    p_amount: input.amount,
    p_vat_type: input.vat_type,
    p_supplier: input.supplier || null,
    p_description: input.description || null,
    p_cost_type_other: input.cost_type === 'other' ? input.cost_type_other || input.description || 'Other' : null,
    p_invoice_url: input.invoice_url || null,
    p_payment_status: input.payment_status || null,
  });
  if (error) return { ok: false as const, error: error.message };
  if (input.vehicle_id) revalidatePath(`/vehicles/${input.vehicle_id}`);
  revalidatePath('/vehicles');
  revalidatePath('/dashboard');
  return { ok: true as const };
}

export async function deleteCost(costId: string, vehicleId: string) {
  const auth = await requireAuth();
  if (!canWrite(auth.role)) return { ok: false as const, error: 'Your role is read-only.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('pm_delete_vehicle_cost', { p_cost_id: costId });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath('/vehicles');
  revalidatePath('/dashboard');
  return { ok: true as const };
}

/** Uploads a receipt/invoice image to the shared "invoices" bucket (same path scheme as the DMS). */
export async function uploadReceipt(formData: FormData): Promise<{ ok: true; url: string; path: string } | { ok: false; error: string }> {
  const auth = await requireAuth();
  if (!canWrite(auth.role)) return { ok: false, error: 'Your role is read-only.' };
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'No file received.' };
  if (file.size > 12 * 1024 * 1024) return { ok: false, error: 'File is larger than 12 MB.' };
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `expenses/${auth.dealership.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const admin = supabaseAdmin();
  const { error } = await admin.storage.from('invoices').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
  if (error) return { ok: false, error: error.message };
  const { data } = admin.storage.from('invoices').getPublicUrl(path);
  return { ok: true, url: data.publicUrl, path };
}

export async function saveTaxAssumptions(input: { corp_tax_rate: number; vat_rate: number; vat_quarter_start: string | null; notes: string | null }) {
  const auth = await requireAuth();
  if (!canWrite(auth.role)) return { ok: false as const, error: 'Your role is read-only.' };
  const supabase = await createClient();
  const { error } = await supabase.from('pm_tax_assumptions').upsert({
    dealership_id: auth.dealership.id,
    corp_tax_rate: input.corp_tax_rate,
    vat_rate: input.vat_rate,
    vat_quarter_start: input.vat_quarter_start,
    notes: input.notes,
    updated_by: auth.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/tax');
  revalidatePath('/dashboard');
  return { ok: true as const };
}

export async function switchDealership(dealershipId: string) {
  const auth = await requireAuth();
  if (!auth.dealerships.some((d) => d.id === dealershipId)) return;
  cookies().set(DEALERSHIP_COOKIE, dealershipId, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
