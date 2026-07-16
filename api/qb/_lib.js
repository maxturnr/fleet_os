// Shared QuickBooks helpers for the Fleet OS Vercel functions.
// Env vars required (set in Vercel project settings, never committed):
//   QB_CLIENT_ID, QB_CLIENT_SECRET  – Intuit production keys
//   QB_WEBHOOK_VERIFIER             – Intuit webhook verifier token
//   FLEET_SUPABASE_SERVICE_KEY      – fleet Supabase service role key
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const ACCOUNT_ID = 1
export const SUPABASE_URL = 'https://hnypmigzwfavwcwarmnk.supabase.co'
export const BASE_URL = process.env.QB_REDIRECT_BASE || 'https://www.pierfront.co'
export const REDIRECT_URI = `${BASE_URL}/api/qb/callback`
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const API_BASE = 'https://quickbooks.api.intuit.com/v3/company'
const MINOR_VERSION = 75

export function admin() {
  const key = process.env.FLEET_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!key) throw new Error('Supabase service key not configured')
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } })
}

// ── OAuth state (HMAC-signed timestamp, 10 min validity) ──
export function signState() {
  const ts = String(Date.now())
  const sig = crypto.createHmac('sha256', process.env.QB_CLIENT_SECRET).update(ts).digest('hex')
  return `${ts}.${sig}`
}
export function verifyState(state) {
  if (!state || !state.includes('.')) return false
  const [ts, sig] = state.split('.')
  const expect = crypto.createHmac('sha256', process.env.QB_CLIENT_SECRET).update(ts).digest('hex')
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return false
  } catch { return false }
  return Date.now() - Number(ts) < 10 * 60 * 1000
}

// ── Token endpoints ──
async function tokenRequest(params) {
  const basic = Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(params).toString(),
  })
  if (!res.ok) throw new Error(`Token request failed (${res.status}): ${await res.text()}`)
  return res.json()
}

export function exchangeCode(code) {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI })
}

export function tokenRowFromResponse(tok) {
  const now = Date.now()
  return {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    token_expires_at: new Date(now + tok.expires_in * 1000).toISOString(),
    refresh_token_expires_at: new Date(now + tok.x_refresh_token_expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }
}

// Returns the active connection with a fresh access token (refreshes + persists rotation if needed)
export async function getValidConnection(sb) {
  const { data: conn, error } = await sb
    .from('quickbooks_connections')
    .select('*')
    .eq('account_id', ACCOUNT_ID)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!conn) return null
  if (new Date(conn.token_expires_at).getTime() - Date.now() > 5 * 60 * 1000) return conn
  const tok = await tokenRequest({ grant_type: 'refresh_token', refresh_token: conn.refresh_token })
  const patch = tokenRowFromResponse(tok)
  await sb.from('quickbooks_connections').update(patch).eq('id', conn.id)
  return { ...conn, ...patch }
}

async function qbQuery(conn, sql) {
  const url = `${API_BASE}/${conn.realm_id}/query?query=${encodeURIComponent(sql)}&minorversion=${MINOR_VERSION}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${conn.access_token}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`QB query failed (${res.status}): ${await res.text()}`)
  return res.json()
}

export async function fetchCompanyName(conn) {
  try {
    const data = await qbQuery(conn, 'select CompanyName from CompanyInfo')
    return data?.QueryResponse?.CompanyInfo?.[0]?.CompanyName || null
  } catch { return null }
}

async function fetchAllSince(conn, entity, sinceIso) {
  const out = []
  let start = 1
  const pageSize = 100
  for (let page = 0; page < 20; page++) {
    const sql = `select * from ${entity} where MetaData.LastUpdatedTime > '${sinceIso}' orderby MetaData.LastUpdatedTime startposition ${start} maxresults ${pageSize}`
    const data = await qbQuery(conn, sql)
    const rows = data?.QueryResponse?.[entity] || []
    out.push(...rows)
    if (rows.length < pageSize) break
    start += pageSize
  }
  return out
}

function mapPaymentType(pt) {
  if (pt === 'Cash') return 'cash'
  if (pt === 'CreditCard') return 'card'
  return 'bank_transfer'
}

function depositDescription(d) {
  if (d.PrivateNote) return d.PrivateNote
  const names = (d.Line || [])
    .map(l => l.DepositLineDetail?.Entity?.name || l.Description)
    .filter(Boolean)
  return names.length ? names.join(', ') : 'QuickBooks deposit'
}

// ── Main sync: QBO Purchases + Deposits → qb_transactions staging (reconciliation
// inbox in Fleet), plus bank account balances for mapped fleet accounts ──
export async function syncConnection(sb, conn) {
  const syncStartedAt = new Date().toISOString()
  const since = conn.last_synced_at
    ? new Date(new Date(conn.last_synced_at).getTime() - 10 * 60 * 1000) // 10 min overlap
    : new Date('2000-01-01') // first sync: full history
  const sinceIso = since.toISOString()

  const purchases = await fetchAllSince(conn, 'Purchase', sinceIso)
  const deposits = await fetchAllSince(conn, 'Deposit', sinceIso)

  const counts = { new: 0, updated: 0, skipped: 0, balances_updated: 0 }
  const rows = []

  for (const p of purchases) {
    const amount = Number(p.TotalAmt) || 0
    if (amount <= 0) { counts.skipped++; continue }
    rows.push({
      account_id: ACCOUNT_ID,
      qb_id: `purchase:${p.Id}`,
      qb_type: 'Purchase',
      direction: p.Credit === true ? 'in' : 'out', // supplier refunds come back in
      txn_date: p.TxnDate,
      amount,
      payee: p.EntityRef?.name || null,
      memo: p.PrivateNote || null,
      qb_account_name: p.AccountRef?.name || null,
      payment_type: p.PaymentType || null,
      raw: p,
    })
  }
  for (const d of deposits) {
    const amount = Number(d.TotalAmt) || 0
    if (amount <= 0) { counts.skipped++; continue }
    rows.push({
      account_id: ACCOUNT_ID,
      qb_id: `deposit:${d.Id}`,
      qb_type: 'Deposit',
      direction: 'in',
      txn_date: d.TxnDate,
      amount,
      payee: depositDescription(d),
      memo: d.PrivateNote || null,
      qb_account_name: d.DepositToAccountRef?.name || null,
      payment_type: null,
      raw: d,
    })
  }

  if (rows.length) {
    // Never regress rows the user already handled: only update pending ones
    const { data: existing } = await sb
      .from('qb_transactions')
      .select('qb_id, status')
      .in('qb_id', rows.map(r => r.qb_id))
    const byId = new Map((existing || []).map(r => [r.qb_id, r.status]))
    const inserts = rows.filter(r => !byId.has(r.qb_id))
    const updates = rows.filter(r => byId.get(r.qb_id) === 'pending')
    if (inserts.length) {
      const { error } = await sb.from('qb_transactions').insert(inserts)
      if (error) throw error
      counts.new = inserts.length
    }
    for (const r of updates) {
      await sb.from('qb_transactions')
        .update({ txn_date: r.txn_date, amount: r.amount, payee: r.payee, memo: r.memo,
                  qb_account_name: r.qb_account_name, direction: r.direction, raw: r.raw,
                  updated_at: new Date().toISOString() })
        .eq('qb_id', r.qb_id)
    }
    counts.updated = updates.length
  }

  counts.balances_updated = await syncBankBalances(sb, conn)

  await sb.from('quickbooks_connections').update({ last_synced_at: syncStartedAt }).eq('id', conn.id)
  return counts
}

// Pull QBO bank accounts, snapshot them for the UI, and update the balance of
// any fleet bank account mapped via bank_accounts.qb_account_id
export async function syncBankBalances(sb, conn) {
  let updated = 0
  try {
    const data = await qbQuery(conn, "select * from Account where AccountType = 'Bank'")
    const accounts = (data?.QueryResponse?.Account || []).map(a => ({
      id: a.Id, name: a.Name, balance: Number(a.CurrentBalance) || 0,
    }))
    if (!accounts.length) return 0
    await sb.from('settings').upsert(
      { key: 'qb_bank_accounts', account_id: ACCOUNT_ID, value: JSON.stringify({ at: new Date().toISOString(), accounts }) },
      { onConflict: 'key' },
    )
    const { data: fleetAccounts } = await sb
      .from('bank_accounts')
      .select('id, qb_account_id')
      .not('qb_account_id', 'is', null)
    for (const fa of fleetAccounts || []) {
      const qb = accounts.find(a => String(a.id) === String(fa.qb_account_id))
      if (!qb) continue
      const { error } = await sb.from('bank_accounts')
        .update({ balance: qb.balance, qb_balance: qb.balance, qb_balance_at: new Date().toISOString() })
        .eq('id', fa.id)
      if (!error) updated++
    }
  } catch (e) {
    console.error('[qb-sync] bank balances failed:', e.message)
  }
  return updated
}

// Webhook Delete events: remove unassigned imported rows that were deleted in QBO
export async function handleDeletes(sb, entities) {
  for (const e of entities) {
    if (e.operation !== 'Delete') continue
    if (e.name !== 'Purchase' && e.name !== 'Deposit') continue
    const qbId = `${e.name.toLowerCase()}:${e.id}`
    // only drop rows still awaiting reconciliation; matched/added rows stay
    await sb.from('qb_transactions').delete()
      .eq('account_id', ACCOUNT_ID).eq('qb_id', qbId).eq('status', 'pending')
  }
}
