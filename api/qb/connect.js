// GET /api/qb/connect — start the QuickBooks OAuth flow
import { REDIRECT_URI, signState } from './_lib.js'

export default async function handler(req, res) {
  if (!process.env.QB_CLIENT_ID || !process.env.QB_CLIENT_SECRET) {
    return res.status(500).json({ error: 'QuickBooks keys not configured. Add QB_CLIENT_ID and QB_CLIENT_SECRET in Vercel env vars.' })
  }
  const params = new URLSearchParams({
    client_id: process.env.QB_CLIENT_ID,
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    state: signState(),
  })
  res.setHeader('Cache-Control', 'no-store')
  res.redirect(302, `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`)
}
