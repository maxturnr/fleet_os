// POST /api/qb/webhook — Intuit webhook receiver (signature-verified)
import crypto from 'crypto'
import { admin, getValidConnection, handleDeletes, syncConnection } from './_lib.js'

export const config = { api: { bodyParser: false } }

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ok: true }) // Intuit endpoint validation
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const verifier = process.env.QB_WEBHOOK_VERIFIER
  if (!verifier) return res.status(500).json({ error: 'QB_WEBHOOK_VERIFIER not configured' })

  const raw = await readRawBody(req)
  const signature = req.headers['intuit-signature']
  const expected = crypto.createHmac('sha256', verifier).update(raw).digest('base64')
  const valid = signature && signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  if (!valid) return res.status(401).json({ error: 'Invalid signature' })

  try {
    const payload = JSON.parse(raw.toString('utf8'))
    const sb = admin()
    const conn = await getValidConnection(sb)
    if (!conn) return res.status(200).json({ ok: true, note: 'no active connection' })

    let relevant = false
    for (const n of payload.eventNotifications || []) {
      if (String(n.realmId) !== String(conn.realm_id)) continue
      const entities = n.dataChangeEvent?.entities || []
      const mine = entities.filter(e => e.name === 'Purchase' || e.name === 'Deposit')
      if (!mine.length) continue
      relevant = true
      await handleDeletes(sb, mine)
    }
    if (relevant) await syncConnection(sb, conn)
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[qb-webhook]', e.message)
    // Return 200 so Intuit doesn't disable the endpoint; daily cron will catch up
    return res.status(200).json({ ok: false })
  }
}
