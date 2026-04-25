const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://hnypmigzwfavwcwarmnk.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
)

/**
 * QuickBooks Webhook Handler for Vercel
 * Receives notifications from QuickBooks when transactions change
 */
module.exports = async (req, res) => {
  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({})
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verify webhook signature
    const signature = req.headers['intuit-signature']
    const webhookToken = process.env.QB_WEBHOOK_TOKEN
    
    if (!webhookToken) {
      console.error('QB_WEBHOOK_TOKEN not configured')
      return res.status(500).json({ error: 'Webhook token not configured' })
    }

    if (signature) {
      const body = JSON.stringify(req.body)
      const hash = crypto
        .createHmac('sha256', webhookToken)
        .update(body)
        .digest('base64')
      
      if (hash !== signature) {
        console.error('Invalid webhook signature')
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }

    // Parse webhook payload
    const payload = req.body
    console.log('Received QB webhook:', JSON.stringify(payload, null, 2))

    // Process each event in the payload
    if (payload.eventNotifications && Array.isArray(payload.eventNotifications)) {
      for (const notification of payload.eventNotifications) {
        const realmId = notification.realmId
        
        if (notification.dataChangeEvent && notification.dataChangeEvent.entities) {
          for (const entity of notification.dataChangeEvent.entities) {
            const entityName = entity.name
            const operation = entity.operation
            const entityId = entity.id

            console.log(`Processing ${operation} for ${entityName} (ID: ${entityId})`)

            if (operation === 'CREATE' || operation === 'UPDATE') {
              await fetchAndStoreTransaction(realmId, entityName, entityId)
            } else if (operation === 'DELETE') {
              await deleteTransaction(entityId, entityName)
            }
          }
        }
      }
    }

    return res.status(200).json({ success: true, message: 'Webhook processed' })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return res.status(500).json({ error: error.message })
  }
}

async function fetchAndStoreTransaction(realmId, entityName, entityId) {
  try {
    const { data: tokenData, error: tokenError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'qb_access_token')
      .single()

    if (tokenError || !tokenData) {
      console.error('No QB access token found')
      return
    }

    const accessToken = tokenData.value

    const qbApiUrl = `https://quickbooks.api.intuit.com/v3/company/${realmId}/${entityName.toLowerCase()}/${entityId}`
    
    const response = await fetch(qbApiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`QB API error: ${response.status}`)
      return
    }

    const data = await response.json()
    const transaction = data[entityName]

    const txData = transformQBTransaction(transaction, entityName)

    const { error: insertError } = await supabase
      .from('transactions')
      .upsert({
        qb_id: `${entityName}_${entityId}`,
        qb_type: entityName,
        date: txData.date,
        description: txData.description,
        amount: txData.amount,
        category: txData.category,
        source: 'quickbooks',
        assigned: false,
        raw_data: transaction
      }, {
        onConflict: 'qb_id'
      })

    if (insertError) {
      console.error('Error storing transaction:', insertError)
    } else {
      console.log(`Stored transaction: ${txData.description} - ${txData.amount}`)
    }

  } catch (error) {
    console.error('Error fetching/storing transaction:', error)
  }
}

async function deleteTransaction(entityId, entityName) {
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('qb_id', `${entityName}_${entityId}`)

    if (error) {
      console.error('Error deleting transaction:', error)
    } else {
      console.log(`Deleted transaction: ${entityName}_${entityId}`)
    }
  } catch (error) {
    console.error('Error deleting transaction:', error)
  }
}

function transformQBTransaction(transaction, entityName) {
  let date = null
  let description = ''
  let amount = 0
  let category = ''

  switch (entityName) {
    case 'Purchase':
      date = transaction.TxnDate
      description = transaction.PaymentType || 'Purchase'
      amount = -(transaction.TotalAmt || 0)
      category = transaction.AccountRef?.name || 'Uncategorized'
      if (transaction.EntityRef) {
        description += ` - ${transaction.EntityRef.name}`
      }
      break

    case 'Bill':
      date = transaction.TxnDate
      description = `Bill from ${transaction.VendorRef?.name || 'Unknown'}`
      amount = -(transaction.TotalAmt || 0)
      category = 'Bills'
      break

    case 'Expense':
      date = transaction.TxnDate
      description = transaction.PaymentType || 'Expense'
      amount = -(transaction.TotalAmt || 0)
      category = transaction.AccountRef?.name || 'Uncategorized'
      if (transaction.EntityRef) {
        description += ` - ${transaction.EntityRef.name}`
      }
      break

    case 'Payment':
      date = transaction.TxnDate
      description = `Payment - ${transaction.CustomerRef?.name || 'Unknown'}`
      amount = transaction.TotalAmt || 0
      category = 'Payments'
      break

    case 'Invoice':
      date = transaction.TxnDate
      description = `Invoice - ${transaction.CustomerRef?.name || 'Unknown'}`
      amount = transaction.TotalAmt || 0
      category = 'Sales'
      break

    case 'SalesReceipt':
      date = transaction.TxnDate
      description = `Sale - ${transaction.CustomerRef?.name || 'Unknown'}`
      amount = transaction.TotalAmt || 0
      category = 'Sales'
      break

    default:
      date = transaction.TxnDate || transaction.MetaData?.CreateTime
      description = `${entityName} transaction`
      amount = transaction.TotalAmt || 0
      category = 'Other'
  }

  if (transaction.PrivateNote) {
    description += ` - ${transaction.PrivateNote}`
  }

  return {
    date,
    description: description.substring(0, 255),
    amount,
    category
  }
}
