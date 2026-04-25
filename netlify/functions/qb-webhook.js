const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://hnypmigzwfavwcwarmnk.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
)

/**
 * QuickBooks Webhook Handler
 * Receives notifications from QuickBooks when transactions change
 * Docs: https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks
 */
exports.handler = async (event, context) => {
  // Handle OPTIONS for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, intuit-signature',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    }
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    // Verify webhook signature
    const signature = event.headers['intuit-signature']
    const webhookToken = process.env.QB_WEBHOOK_TOKEN
    
    if (!webhookToken) {
      console.error('QB_WEBHOOK_TOKEN not configured')
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Webhook token not configured' })
      }
    }

    if (signature) {
      const hash = crypto
        .createHmac('sha256', webhookToken)
        .update(event.body)
        .digest('base64')
      
      if (hash !== signature) {
        console.error('Invalid webhook signature')
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Invalid signature' })
        }
      }
    }

    // Parse webhook payload
    const payload = JSON.parse(event.body)
    console.log('Received QB webhook:', JSON.stringify(payload, null, 2))

    // Process each event in the payload
    if (payload.eventNotifications && Array.isArray(payload.eventNotifications)) {
      for (const notification of payload.eventNotifications) {
        const realmId = notification.realmId
        
        if (notification.dataChangeEvent && notification.dataChangeEvent.entities) {
          for (const entity of notification.dataChangeEvent.entities) {
            // We're interested in Purchase, Bill, Expense, and other transaction types
            const entityName = entity.name
            const operation = entity.operation // CREATE, UPDATE, DELETE
            const entityId = entity.id

            console.log(`Processing ${operation} for ${entityName} (ID: ${entityId})`)

            // Fetch the full transaction details from QuickBooks
            if (operation === 'CREATE' || operation === 'UPDATE') {
              await fetchAndStoreTransaction(realmId, entityName, entityId)
            } else if (operation === 'DELETE') {
              await deleteTransaction(entityId, entityName)
            }
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: true, message: 'Webhook processed' })
    }

  } catch (error) {
    console.error('Webhook processing error:', error)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    }
  }
}

/**
 * Fetch transaction details from QuickBooks and store in Supabase
 */
async function fetchAndStoreTransaction(realmId, entityName, entityId) {
  try {
    // Get stored access token from Supabase
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

    // Fetch transaction from QuickBooks API
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

    // Transform QB transaction to our format
    const txData = transformQBTransaction(transaction, entityName)

    // Store in Supabase transactions table
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
        assigned: false, // User needs to assign to a car
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

/**
 * Delete transaction from Supabase when deleted in QuickBooks
 */
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

/**
 * Transform QuickBooks transaction to our internal format
 */
function transformQBTransaction(transaction, entityName) {
  let date = null
  let description = ''
  let amount = 0
  let category = ''

  // Handle different transaction types
  switch (entityName) {
    case 'Purchase':
      date = transaction.TxnDate
      description = transaction.PaymentType || 'Purchase'
      amount = -(transaction.TotalAmt || 0) // Negative for expenses
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
      amount = transaction.TotalAmt || 0 // Positive for income
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

  // Add memo if available
  if (transaction.PrivateNote) {
    description += ` - ${transaction.PrivateNote}`
  }

  return {
    date,
    description: description.substring(0, 255), // Limit length
    amount,
    category
  }
}
