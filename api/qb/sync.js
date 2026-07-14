// GET/POST /api/qb/sync — manual "sync now" + daily Vercel cron
import { admin, getValidConnection, syncConnection } from './_lib.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const sb = admin()
    const conn = await getValidConnection(sb)
    if (!conn) return res.status(200).json({ connected: false, error: 'QuickBooks not connected' })
    const counts = await syncConnection(sb, conn)
    return res.status(200).json({ connected: true, company: conn.company_name, ...counts })
  } catch (e) {
    console.error('[qb-sync]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
