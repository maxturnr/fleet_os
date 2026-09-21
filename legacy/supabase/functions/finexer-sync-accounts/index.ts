// ═══════════════════════════════════════════════════════════
// FINEXER: SYNC ACCOUNTS
// Manually trigger sync of bank accounts and transactions.
// Called from frontend "Sync" button or background hourly poll.
//
// Flow:
//   1. Get all bank accounts for the customer
//   2. For each account: trigger sync → wait for idle → pull transactions
//   3. Upsert transactions in batches (not one by one)
//   4. Update balances
//   5. Create reconciliation records for new transactions
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { account_id, date_from } = await req.json();

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: 'account_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get account with Finexer customer ID
    const { data: account, error: accountError } = await supabaseClient
      .from('accounts')
      .select('finexer_customer_id')
      .eq('id', account_id)
      .single();

    if (accountError || !account || !account.finexer_customer_id) {
      return new Response(
        JSON.stringify({ error: 'Account not found or not connected to Finexer' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const finexer = createFinexerClient();

    // ── Fetch ALL bank accounts (with pagination) ────────────────────
    console.log('Fetching bank accounts for customer:', account.finexer_customer_id);
    const bankAccounts = await finexer.listAllBankAccounts({
      customer: account.finexer_customer_id,
    });
    console.log('Bank accounts found:', bankAccounts.length);

    let syncedAccounts = 0;
    let syncedTransactions = 0;

    // Get connection ID
    const { data: connection } = await supabaseClient
      .from('bank_connections')
      .select('id')
      .eq('account_id', account_id)
      .eq('provider_customer_id', account.finexer_customer_id)
      .single();

    if (!connection) {
      return new Response(
        JSON.stringify({ error: 'Bank connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Sync each bank account ───────────────────────────────────────
    for (const ba of bankAccounts) {
      try {
        // Fetch balance
        let currentBalance = null;
        let availableBalance = null;
        try {
          const balanceData = await finexer.getBankAccountBalance(ba.id);
          const bal = balanceData.data?.[0];
          if (bal) {
            currentBalance = bal.current ?? null;
            availableBalance = bal.available ?? null;
          }
        } catch (error) {
          console.error('Error fetching balance:', error);
        }

        // Upsert bank account
        console.log('Upserting bank account:', ba.id, ba.nickname || ba.holder_name);
        const { data: upsertedAccount, error: upsertError } = await supabaseClient
          .from('bank_accounts')
          .upsert({
            account_id: account_id,
            bank_connection_id: connection.id,
            provider: 'finexer',
            provider_account_id: ba.id,
            finexer_account_id: ba.id,
            account_name: ba.nickname || ba.holder_name || 'Unknown Account',
            display_name: ba.nickname,
            account_type: ba.type,
            account_subtype: ba.class,
            account_class: ba.class,
            currency: ba.currency?.toUpperCase() || 'GBP',
            masked_account_number: ba.identification?.account_number?.slice(-4),
            sort_code: ba.identification?.sort_code,
            holder_name: ba.holder_name,
            nickname: ba.nickname,
            fingerprint: ba.fingerprint,
            current_balance: currentBalance,
            available_balance: availableBalance,
            balance_as_of: currentBalance != null ? new Date().toISOString() : null,
            last_feed_sync_at: new Date().toISOString(),
          }, {
            onConflict: 'provider,provider_account_id',
          })
          .select()
          .single();

        if (upsertError) {
          console.error('Error upserting bank account:', upsertError);
          continue;
        }

        console.log('Successfully upserted bank account:', ba.id);
        syncedAccounts++;

        // ── Trigger bank sync + pull transactions ────────────────────
        try {
          // Step 1: Trigger sync (pulls latest from bank)
          // Rate limit: 1/hour/account — will return rate_limited if too frequent
          console.log(`Triggering sync for ${ba.id}...`);
          await finexer.syncBankAccountAndWait(ba.id, 60_000);

          // Step 2: Fetch ALL transactions — booked AND pending separately
          // Finexer only returns booked by default; pending needs explicit status=pending
          console.log(`Fetching transactions (booked + pending) for ${ba.id}...`);
          // If date_from was passed, use it as timestamp.gte filter
          const txnParams: Record<string, string> = {};
          if (date_from) {
            txnParams['timestamp.gte'] = date_from;
          }
          const allTransactions = await finexer.listAllTransactionsBothStatuses(ba.id, txnParams);
          console.log(`Total transactions fetched for ${ba.id}: ${allTransactions.length}`);

          if (allTransactions.length === 0) continue;

          // Step 3: Upsert transactions in batches of 500 (not one by one!)
          const bankAccountId = upsertedAccount.id;
          let newTransactionIds: string[] = [];

          // Preserve existing transaction_date — don't overwrite on re-sync
          const { data: existingTxnDates } = await supabaseClient
            .from('bank_transactions')
            .select('provider_transaction_id, transaction_date')
            .eq('bank_account_id', bankAccountId);
          const existingDateMap = new Map(
            (existingTxnDates || []).map((t: any) => [t.provider_transaction_id, t.transaction_date])
          );

          for (let i = 0; i < allTransactions.length; i += 500) {
            const batch = allTransactions.slice(i, i + 500);
            const rows = batch.map((txn: any) => {
              const merchantName = parseMerchantName(txn);
              // Keep existing date if we already have this transaction
              const transactionDate = existingDateMap.get(txn.id) || parseTransactionDate(txn);

              return {
                account_id: account_id,
                bank_account_id: bankAccountId,
                provider: 'finexer',
                provider_transaction_id: txn.id,
                finexer_transaction_id: txn.id,
                direction: mapTransactionDirection(txn.type),
                status: mapTransactionStatus(txn.status),
                amount: Math.abs(Number(txn.amount || 0)),
                currency: (txn.currency || 'GBP').toUpperCase(),
                transaction_date: transactionDate,
                booked_at: txn.status === 'booked' ? txn.timestamp : null,
                reference: txn.reference || null,
                description: txn.description || null,
                merchant_name: merchantName,
                category: txn.category || null,
                running_balance: txn.balance != null ? Number(txn.balance) : null,
                raw_payload: txn,
              };
            });

            // Upsert — duplicates matched on (provider, provider_transaction_id)
            const { data: upsertedTxns, error: txnError } = await supabaseClient
              .from('bank_transactions')
              .upsert(rows, { onConflict: 'finexer_transaction_id' })
              .select('id');

            if (txnError) {
              console.error('Transaction upsert error:', txnError);
            } else if (upsertedTxns) {
              newTransactionIds.push(...upsertedTxns.map((t: any) => t.id));
            }
          }

          syncedTransactions += allTransactions.length;
          console.log(`Synced ${allTransactions.length} transactions for ${ba.id}`);

          // ── Step 3b: Clean up pending→booked duplicates ──────────────
          // Finexer gives different IDs for pending vs booked versions of
          // the same transaction. When a booked version exists, delete the
          // stale pending row. Match on: bank_account_id + amount + description.
          try {
            const { data: deletedPending, error: cleanupError } = await supabaseClient
              .rpc('cleanup_pending_bank_duplicates', {
                p_bank_account_id: bankAccountId,
              });
            if (cleanupError) {
              // If RPC doesn't exist yet, fall back to manual query
              console.log('RPC cleanup not available, running inline cleanup...');
              // Get all pending + booked transactions for this bank account
              const { data: allDbTxns } = await supabaseClient
                .from('bank_transactions')
                .select('id, status, amount, description, merchant_name, transaction_date')
                .eq('bank_account_id', bankAccountId)
                .in('status', ['pending', 'booked']);

              if (allDbTxns && allDbTxns.length > 0) {
                const pending = allDbTxns.filter(t => t.status === 'pending');
                const booked = allDbTxns.filter(t => t.status === 'booked');
                const idsToDelete: string[] = [];

                // Fuzzy match: pending merchant names are often truncated by the bank
                const fuzzyMatch = (a: string | null, b: string | null): boolean => {
                  if (!a || !b) return false;
                  const la = a.toLowerCase().trim(), lb = b.toLowerCase().trim();
                  if (la === lb) return true;
                  const shorter = la.length <= lb.length ? la : lb;
                  const longer = la.length > lb.length ? la : lb;
                  return shorter.length >= 6 && longer.startsWith(shorter);
                };

                for (const p of pending) {
                  // Match: same amount + fuzzy merchant/description (cross-check both fields)
                  const match = booked.find(b =>
                    Number(b.amount) === Number(p.amount) &&
                    (
                      fuzzyMatch(b.description, p.description) ||
                      fuzzyMatch(b.merchant_name, p.merchant_name) ||
                      fuzzyMatch(b.description, p.merchant_name) ||
                      fuzzyMatch(b.merchant_name, p.description)
                    )
                  );
                  if (match) {
                    // Preserve the original pending date on the booked transaction
                    if (p.transaction_date && p.transaction_date < match.transaction_date) {
                      await supabaseClient
                        .from('bank_transactions')
                        .update({ transaction_date: p.transaction_date })
                        .eq('id', match.id);
                      console.log(`Preserved pending date ${p.transaction_date} on booked txn ${match.id}`);
                    }
                    idsToDelete.push(p.id);
                  }
                }

                if (idsToDelete.length > 0) {
                  // Delete matching reconciliation records first
                  await supabaseClient
                    .from('reconciliations')
                    .delete()
                    .in('bank_transaction_id', idsToDelete);

                  const { error: deleteError } = await supabaseClient
                    .from('bank_transactions')
                    .delete()
                    .in('id', idsToDelete);

                  if (deleteError) {
                    console.error('Error deleting pending duplicates:', deleteError);
                  } else {
                    console.log(`Cleaned up ${idsToDelete.length} pending duplicates for ${ba.id}`);
                    syncedTransactions -= idsToDelete.length;
                  }
                }
              }
            } else {
              console.log(`RPC cleanup result for ${ba.id}:`, deletedPending);
            }
          } catch (cleanupErr: any) {
            console.error('Cleanup error (non-fatal):', cleanupErr.message);
          }

          // Step 4: Create reconciliation records for NEW transactions
          // (upsert won't tell us which were new vs updated, so we check)
          if (newTransactionIds.length > 0) {
            // Find which transaction IDs don't already have reconciliation records
            const { data: existingRecons } = await supabaseClient
              .from('reconciliations')
              .select('bank_transaction_id')
              .in('bank_transaction_id', newTransactionIds);

            const existingSet = new Set((existingRecons || []).map((r: any) => r.bank_transaction_id));
            const newRecons = newTransactionIds
              .filter(id => !existingSet.has(id))
              .map(id => ({
                account_id: account_id,
                bank_transaction_id: id,
                status: 'new',
              }));

            if (newRecons.length > 0) {
              // Batch insert reconciliation records
              for (let i = 0; i < newRecons.length; i += 500) {
                await supabaseClient
                  .from('reconciliations')
                  .insert(newRecons.slice(i, i + 500));
              }
              console.log(`Created ${newRecons.length} reconciliation records`);
            }
          }
        } catch (txnError: any) {
          console.error('Error syncing transactions for account', ba.id, ':', txnError.message);
        }
      } catch (accountError: any) {
        console.error('Error processing bank account', ba.id, ':', accountError.message);
      }
    }

    // Update connection last synced
    await supabaseClient
      .from('bank_connections')
      .update({
        last_synced_at: new Date().toISOString(),
        last_auto_synced_at: new Date().toISOString(),
        status: syncedAccounts > 0 ? 'active' : undefined,
      })
      .eq('id', connection.id);

    return new Response(
      JSON.stringify({
        success: true,
        synced_accounts: syncedAccounts,
        synced_transactions: syncedTransactions,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
