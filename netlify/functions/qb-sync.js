const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { access_token, realm_id, account_id, supabase_url, supabase_key } = JSON.parse(event.body);

    if (!access_token || !realm_id || !account_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    const qbHeaders = {
      'Authorization': `Bearer ${access_token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    const baseUrl = `https://quickbooks.api.intuit.com/v3/company/${realm_id}`;
    
    const results = {
      bank_accounts: 0,
      transactions: 0,
      errors: []
    };

    // 1. FETCH BANK ACCOUNTS
    try {
      const accountsRes = await fetch(`${baseUrl}/query?query=SELECT * FROM Account WHERE AccountType='Bank' AND Active=true`, {
        headers: qbHeaders
      });
      
      if (!accountsRes.ok) {
        throw new Error(`QB Accounts API error: ${accountsRes.status}`);
      }

      const accountsData = await accountsRes.json();
      const qbAccounts = accountsData.QueryResponse?.Account || [];

      // Insert bank accounts into Supabase
      for (const acc of qbAccounts) {
        const bankAccount = {
          account_id: account_id,
          account_name: acc.Name,
          account_type: 'Current',
          account_number: acc.AcctNum || null,
          is_default: false,
          active: true,
          qb_account_id: acc.Id
        };

        const insertRes = await fetch(`${supabase_url}/rest/v1/bank_accounts`, {
          method: 'POST',
          headers: {
            'apikey': supabase_key,
            'Authorization': `Bearer ${supabase_key}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(bankAccount)
        });

        if (insertRes.ok) {
          results.bank_accounts++;
        }
      }
    } catch (err) {
      results.errors.push(`Bank accounts error: ${err.message}`);
    }

    // 2. FETCH TRANSACTIONS (Purchases and Expenses)
    try {
      // Get purchases
      const purchasesRes = await fetch(`${baseUrl}/query?query=SELECT * FROM Purchase WHERE TxnDate >= '2024-01-01' MAXRESULTS 1000`, {
        headers: qbHeaders
      });

      if (!purchasesRes.ok) {
        throw new Error(`QB Purchases API error: ${purchasesRes.status}`);
      }

      const purchasesData = await purchasesRes.json();
      const purchases = purchasesData.QueryResponse?.Purchase || [];

      // Map QB transactions to our format
      for (const purchase of purchases) {
        const line = purchase.Line?.[0];
        if (!line) continue;

        const transaction = {
          account_id: account_id,
          date: purchase.TxnDate,
          supplier: purchase.EntityRef?.name || 'Unknown',
          type: line.DetailType === 'AccountBasedExpenseLineDetail' ? 
                (line.AccountBasedExpenseLineDetail?.AccountRef?.name || 'Other') : 'Other',
          amount: parseFloat(purchase.TotalAmt) || 0,
          vat: 'No',
          method: purchase.PaymentType === 'Cash' ? 'Bank Transfer' : 'Card',
          thirty_day: 'No',
          status: 'Paid',
          source: 'quickbooks',
          assigned: false,
          qb_transaction_id: purchase.Id,
          notes: purchase.PrivateNote || null
        };

        const insertRes = await fetch(`${supabase_url}/rest/v1/transactions`, {
          method: 'POST',
          headers: {
            'apikey': supabase_key,
            'Authorization': `Bearer ${supabase_key}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(transaction)
        });

        if (insertRes.ok) {
          results.transactions++;
        }
      }
    } catch (err) {
      results.errors.push(`Transactions error: ${err.message}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Synced ${results.bank_accounts} bank accounts and ${results.transactions} transactions`,
        results
      })
    };

  } catch (error) {
    console.error('QB Sync Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Sync failed', 
        message: error.message 
      })
    };
  }
};
