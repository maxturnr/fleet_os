// ═══════════════════════════════════════════════════════════
// FINEXER: AUTO-SYNC (CRON)
// Background polling function that syncs ALL active bank
// connections without requiring user auth.
//
// Called by pg_cron every 5 minutes via pg_net.
// Uses service_role key — no user JWT required.
//
// Security: Invoke with ?secret=<CRON_SECRET> to prevent
// unauthorized calls.
// ═══════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createFinexerClient,
  mapTransactionDirection,
  mapTransactionStatus,
  parseMerchantName,
  parseTransactionDate,
} from '../_shared/finexer-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth: accept cron secret, service_role Bearer, or anon+secret ──
    const cronSecret = Deno.env.get('CRON_SECRET');
    const url = new URL(req.url);
    const providedSecret = url.searchParams.get('secret');
    const authHeader = req.headers.get('Authorization') || '';

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const isServiceRole = authHeader.includes(serviceRoleKey) && serviceRoleKey.length > 10;
    const isCronAuth = cronSecret && cronSecret.length > 10 && providedSecret === cronSecret;

    if (!isServiceRole && !isCronAuth) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Service-role Supabase client ─────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
    );

    const finexer = createFinexerClient();

    // ── Get ALL active bank connections ──────────────────────────
    const { data: connections, error: connError } = await supabase
      .from('bank_connections')
      .select('id, account_id, provider_customer_id, status')
      .eq('status', 'active');

    if (connError) {
      throw new Error(`Failed to fetch connections: ${connError.message}`);
    }

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active connections' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Auto-sync: Processing ${connections.length} active connection(s)`);

    let totalSyncedAccounts = 0;
    let totalSyncedTransactions = 0;
    let totalNewTransactions = 0;
    const errors: string[] = [];

    for (const conn of connections) {
      try {
        // ── Fetch bank accounts for this customer ──────────────
        const bankAccounts = await finexer.listAllBankAccounts({
          customer: conn.provider_customer_id,
        });

        for (const ba of bankAccounts) {
          try {
            // ── Fetch + update balance ───────────────────────────
            let currentBalance = null;
            let availableBalance = null;
            try {
              const balanceData = await finexer.getBankAccountBalance(ba.id);
              const bal = balanceData.data?.[0];
              if (bal) {
                currentBalance = bal.current ?? null;
                availableBalance = bal.available ?? null;
              }
            } catch (e: any) {
              console.error(`Balance fetch error for ${ba.id}:`, e.message);
            }

            // ── Upsert bank account ──────────────────────────────
            const { data: upsertedAccount, error: upsertError } = await supabase
              .from('bank_accounts')
              .upsert({
                account_id: conn.account_id,
                bank_connection_id: conn.id,
                provider: 'finexer',
                provider_account_id: ba.id,
                finexer_account_id: ba.id,
                account_name: ba.nickname || ba.holder_name || 'Unknown Account',
                display_name: ba.nickname,
                account_type: ba.type,
                account_subtype: ba.class,
                account_class: ba.class,
                currency: (ba.currency || 'GBP').toUpperCase(),
                masked_account_number: ba.identification?.account_number?.slice(-4),
                sort_code: ba.identification?.sort_code,
                holder_name: ba.holder_name,
                nickname: ba.nickname,
                fingerprint: ba.fingerprint,
                current_balance: currentBalance,
                available_balance: availableBalance,
                balance_as_of: currentBalance != null ? new Date().toISOString() : null,
                last_feed_sync_at: new Date().toISOString(),
              }, { onConflict: 'provider,provider_account_id' })
              .select()
              .single();

            if (upsertError) {
              console.error(`Upsert error for ${ba.id}:`, upsertError);
              continue;
            }

            totalSyncedAccounts++;
            const bankAccountId = upsertedAccount.id;

            // ── Trigger bank-side sync (1/hr rate limit) ─────────
            try {
              await finexer.syncBankAccountAndWait(ba.id, 30_000);
            } catch (e: any) {
              console.log(`Sync trigger for ${ba.id}: ${e.message}`);
            }

            // ── Fetch ALL transactions (booked + pending) ────────
            const allTransactions = await finexer.listAllTransactionsBothStatuses(ba.id);
            console.log(`${ba.id}: fetched ${allTransactions.length} transactions`);

            if (allTransactions.length === 0) continue;

            // ── Track which IDs existed before for "new" detection ──
            const { data: existingTxns } = await supabase
              .from('bank_transactions')
              .select('provider_transaction_id')
              .eq('bank_account_id', bankAccountId);
            const existingIds = new Set((existingTxns || []).map((t: any) => t.provider_transaction_id));

            // ── Upsert in batches ────────────────────────────────
            let upsertedIds: string[] = [];

            for (let i = 0; i < allTransactions.length; i += 500) {
              const batch = allTransactions.slice(i, i + 500);
              const rows = batch.map((txn: any) => ({
                account_id: conn.account_id,
                bank_account_id: bankAccountId,
                provider: 'finexer',
                provider_transaction_id: txn.id,
                finexer_transaction_id: txn.id,
                direction: mapTransactionDirection(txn.type),
                status: mapTransactionStatus(txn.status),
                amount: Math.abs(Number(txn.amount || 0)),
                currency: (txn.currency || 'GBP').toUpperCase(),
                transaction_date: parseTransactionDate(txn),
                booked_at: txn.status === 'booked' ? txn.timestamp : null,
                reference: txn.reference || null,
                description: txn.description || null,
                merchant_name: parseMerchantName(txn),
                category: txn.category || null,
                running_balance: txn.balance != null ? Number(txn.balance) : null,
                raw_payload: txn,
              }));

              const { data: upsertedTxns, error: txnError } = await supabase
                .from('bank_transactions')
                .upsert(rows, { onConflict: 'finexer_transaction_id' })
                .select('id, provider_transaction_id');

              if (txnError) {
                console.error('Transaction upsert error:', txnError);
              } else if (upsertedTxns) {
                upsertedIds.push(...upsertedTxns.map((t: any) => t.id));

                // Count genuinely NEW transactions (not in DB before)
                const newOnes = upsertedTxns.filter(
                  (t: any) => !existingIds.has(t.provider_transaction_id)
                );
                totalNewTransactions += newOnes.length;
              }
            }

            totalSyncedTransactions += allTransactions.length;

            // ── Dedup: remove pending when booked twin exists ────
            // Preserve the pending row's transaction_date on the booked twin
            // so the transaction stays on the date it was first seen.
            try {
              const { data: allDbTxns } = await supabase
                .from('bank_transactions')
                .select('id, status, amount, description, merchant_name, transaction_date')
                .eq('bank_account_id', bankAccountId)
                .in('status', ['pending', 'booked']);

              if (allDbTxns && allDbTxns.length > 0) {
                const pending = allDbTxns.filter((t: any) => t.status === 'pending');
                const booked = allDbTxns.filter((t: any) => t.status === 'booked');
                const idsToDelete: string[] = [];

                const fuzzyMatch = (a: string | null, b: string | null): boolean => {
                  if (!a || !b) return false;
                  const la = a.toLowerCase().trim(), lb = b.toLowerCase().trim();
                  if (la === lb) return true;
                  const shorter = la.length <= lb.length ? la : lb;
                  const longer = la.length > lb.length ? la : lb;
                  return shorter.length >= 6 && longer.startsWith(shorter);
                };

                for (const p of pending) {
                  const match = booked.find((b: any) =>
                    Number(b.amount) === Number(p.amount) &&
                    (
                      fuzzyMatch(b.description, p.description) ||
                      fuzzyMatch(b.merchant_name, p.merchant_name) ||
                      fuzzyMatch(b.description, p.merchant_name) ||
                      fuzzyMatch(b.merchant_name, p.description)
                    )
                  );
                  if (match) {
                    // Keep the original pending date on the booked transaction
                    if (p.transaction_date && p.transaction_date < match.transaction_date) {
                      await supabase
                        .from('bank_transactions')
                        .update({ transaction_date: p.transaction_date })
                        .eq('id', match.id);
                      console.log(`Preserved pending date ${p.transaction_date} on booked txn ${match.id}`);
                    }
                    idsToDelete.push(p.id);
                  }
                }

                if (idsToDelete.length > 0) {
                  await supabase.from('reconciliations').delete().in('bank_transaction_id', idsToDelete);
                  await supabase.from('bank_transactions').delete().in('id', idsToDelete);
                  console.log(`Cleaned ${idsToDelete.length} pending dupes for ${ba.id}`);
                }
              }
            } catch (e: any) {
              console.error('Dedup error:', e.message);
            }

            // ── Create reconciliation records for new transactions ──
            if (upsertedIds.length > 0) {
              const { data: existingRecons } = await supabase
                .from('reconciliations')
                .select('bank_transaction_id')
                .in('bank_transaction_id', upsertedIds);

              const reconSet = new Set((existingRecons || []).map((r: any) => r.bank_transaction_id));
              const newRecons = upsertedIds
                .filter(id => !reconSet.has(id))
                .map(id => ({
                  account_id: conn.account_id,
                  bank_transaction_id: id,
                  status: 'new',
                }));

              if (newRecons.length > 0) {
                for (let i = 0; i < newRecons.length; i += 500) {
                  await supabase.from('reconciliations').insert(newRecons.slice(i, i + 500));
                }
              }
            }
          } catch (baErr: any) {
            const msg = `Account ${ba.id}: ${baErr.message}`;
            console.error(msg);
            errors.push(msg);
          }
        }

        // Update connection last synced
        await supabase
          .from('bank_connections')
          .update({
            last_synced_at: new Date().toISOString(),
            last_auto_synced_at: new Date().toISOString(),
          })
          .eq('id', conn.id);
      } catch (connErr: any) {
        const msg = `Connection ${conn.id}: ${connErr.message}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    const result = {
      success: true,
      synced_accounts: totalSyncedAccounts,
      synced_transactions: totalSyncedTransactions,
      new_transactions: totalNewTransactions,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    };

    console.log('Auto-sync complete:', JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Auto-sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
