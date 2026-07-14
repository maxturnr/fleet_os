// GET /api/qb/callback — OAuth redirect from Intuit
import {
  ACCOUNT_ID, admin, exchangeCode, fetchCompanyName,
  syncConnection, tokenRowFromResponse, verifyState,
} from './_lib.js'

export default async function handler(req, res) {
  const { code, state, realmId, error } = req.query
  const back = (status) => { res.setHeader('Cache-Control', 'no-store'); res.redirect(302, `/?qb=${status}`) }
  if (error || !code || !realmId) return back('error')
  if (!verifyState(state)) return back('error')

  try {
    const tok = await exchangeCode(code)
    const sb = admin()
    const row = {
      account_id: ACCOUNT_ID,
      realm_id: String(realmId),
      ...tokenRowFromResponse(tok),
      environment: 'production',
      is_active: true,
    }
    const { data: conn, error: upErr } = await sb
      .from('quickbooks_connections')
      .upsert(row, { onConflict: 'account_id,realm_id' })
      .select()
      .single()
    if (upErr) throw upErr

    const companyName = await fetchCompanyName(conn)
    if (companyName) await sb.from('quickbooks_connections').update({ company_name: companyName }).eq('id', conn.id)
    await sb.from('settings').upsert({ key: 'qb_connected', value: 'true' }, { onConflict: 'key' })

    // Initial pull (last 90 days) so transactions appear immediately
    try { await syncConnection(sb, conn) } catch (e) { console.error('[qb-callback] initial sync failed:', e.message) }

    return back('connected')
  } catch (e) {
    console.error('[qb-callback]', e.message)
    return back('error')
  }
}
