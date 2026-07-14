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

// ── Main sync: QBO Purchases → fleet expenses (unassigned), Deposits → fleet income ──
export async function syncConnection(sb, conn) {
  const syncStartedAt = new Date().toISOString()
  const since = conn.last_synced_at
    ? new Date(new Date(conn.last_synced_at).getTime() - 10 * 60 * 1000) // 10 min overlap
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // first sync: last 90 days
  const sinceIso = since.toISOString()

  const [purchases, deposits] = await Promise.all([
    fetchAllSince(conn, 'Purchase', sinceIso),
    fetchAllSince(conn, 'Deposit', sinceIso),
  ])

  const counts = { purchases_new: 0, purchases_updated: 0, purchases_skipped: 0, deposits_new: 0, deposits_skipped: 0 }

  // Purchases → expenses
  if (purchases.length) {
    const qbIds = purchases.map(p => `purchase:${p.Id}`)
    const { data: existing } = await sb
      .from('expenses')
      .select('id, qb_id, assigned')
      .eq('account_id', ACCOUNT_ID)
      .in('qb_id', qbIds)
    const byQbId = new Map((existing || []).map(r => [r.qb_id, r]))
    const inserts = []
    for (const p of purchases) {
      if (p.Credit === true) { counts.purchases_skipped++; continue } // supplier refunds: handle manually
      const amount = Number(p.TotalAmt) || 0
      if (amount <= 0) { counts.purchases_skipped++; continue }
      const qbId = `purchase:${p.Id}`
      const supplier = p.EntityRef?.name || p.AccountRef?.name || 'QuickBooks'
      const prev = byQbId.get(qbId)
      const fields = {
        date: p.TxnDate,
        supplier,
        amount,
        memo: p.PrivateNote || null,
        method: mapPaymentType(p.PaymentType),
        raw_data: p,
      }
      if (prev) {
        if (!prev.assigned) {
          await sb.from('expenses').update(fields).eq('id', prev.id)
          counts.purchases_updated++
        } else counts.purchases_skipped++
      } else {
        inserts.push({
          account_id: ACCOUNT_ID,
          ...fields,
          type: 'other',
          status: 'Paid',
          payment_status: 'paid',
          paid_date: p.TxnDate,
          thirty_day: 'no',
          source: 'quickbooks',
          assigned: false,
          qb_id: qbId,
          qb_type: 'Purchase',
          vat_status: 'no-vat',
          net_amount: amount,
          vat_amount: 0,
          is_overhead: false,
          notes: 'Imported from QuickBooks',
        })
      }
    }
    if (inserts.length) {
      const { error } = await sb.from('expenses').insert(inserts)
      if (error) throw error
      counts.purchases_new = inserts.length
    }
  }

  // Deposits → income
  if (deposits.length) {
    const refs = deposits.map(d => `qb:deposit:${d.Id}`)
    const { data: existing } = await sb
      .from('income')
      .select('reference')
      .eq('account_id', ACCOUNT_ID)
      .in('reference', refs)
    const seen = new Set((existing || []).map(r => r.reference))
    const inserts = []
    for (const d of deposits) {
      const ref = `qb:deposit:${d.Id}`
      const amount = Number(d.TotalAmt) || 0
      if (seen.has(ref) || amount <= 0) { counts.deposits_skipped++; continue }
      inserts.push({
        account_id: ACCOUNT_ID,
        type: 'other',
        amount,
        net_amount: amount,
        vat_amount: 0,
        vat_status: 'no-vat',
        is_general: true,
        stock_id: null,
        bank_account_id: null,
        payment_method: 'bank_transfer',
        reference: ref,
        date: d.TxnDate,
        description: depositDescription(d),
        notes: 'Imported from QuickBooks',
      })
    }
    if (inserts.length) {
      const { error } = await sb.from('income').insert(inserts)
      if (error) throw error
      counts.deposits_new = inserts.length
    }
  }

  await sb.from('quickbooks_connections').update({ last_synced_at: syncStartedAt }).eq('id', conn.id)
  return counts
}

// Webhook Delete events: remove unassigned imported rows that were deleted in QBO
export async function handleDeletes(sb, entities) {
  for (const e of entities) {
    if (e.operation !== 'Delete') continue
    if (e.name === 'Purchase') {
      await sb.from('expenses').delete()
        .eq('account_id', ACCOUNT_ID).eq('qb_id', `purchase:${e.id}`)
        .eq('source', 'quickbooks').eq('assigned', false)
    } else if (e.name === 'Deposit') {
      await sb.from('income').delete()
        .eq('account_id', ACCOUNT_ID).eq('reference', `qb:deposit:${e.id}`)
        .eq('type', 'other').eq('is_general', true)
    }
  }
}
