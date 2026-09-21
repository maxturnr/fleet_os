# QuickBooks Webhook Setup Guide

This guide will help you set up the QuickBooks webhook integration to automatically sync transactions to your Fleet OS.

## Prerequisites

- QuickBooks Online account with API access
- Intuit Developer account with your app configured
- Netlify account for hosting
- Supabase database already set up

## Step 1: Update Database Schema

Run the updated `migration.sql` in your Supabase SQL Editor. This adds the necessary columns for QB integration:
- `qb_id` - Unique identifier for QB transactions
- `qb_type` - Transaction type (Purchase, Bill, Expense, etc.)
- `raw_data` - Full QB transaction data (JSONB)

## Step 2: Configure Environment Variables in Netlify

Go to your Netlify site settings → Environment Variables and add:

```
SUPABASE_URL=https://hnypmigzwfavwcwarmnk.supabase.co
SUPABASE_SERVICE_KEY=<your_supabase_service_role_key>
QB_CLIENT_ID=ABcPoVXTxYiF0DTS1XHFuh9NJMYamffDlLGFPIq155E5ZdPIXZ
QB_CLIENT_SECRET=<your_qb_client_secret>
QB_WEBHOOK_TOKEN=<generate_a_random_string>
QB_ENVIRONMENT=sandbox (or production)
```

### Getting Your Keys:

**Supabase Service Key:**
1. Go to Supabase Dashboard → Project Settings → API
2. Copy the `service_role` key (NOT the anon key)

**QB Client Secret:**
1. Go to https://developer.intuit.com/
2. Navigate to your app → Keys & credentials
3. Copy the Client Secret

**QB Webhook Token:**
- Generate a random string (e.g., use: `openssl rand -base64 32`)
- Save this - you'll need it when configuring the webhook in Intuit

## Step 3: Deploy to Netlify

```bash
# Install dependencies
npm install

# Deploy to Netlify
npm run deploy
```

Or connect your GitHub repo to Netlify for automatic deployments.

## Step 4: Configure Webhook in Intuit Developer Portal

1. Go to https://developer.intuit.com/
2. Select your app → Webhooks
3. Click "Add webhook"
4. Enter webhook URL: `https://your-site.netlify.app/.netlify/functions/qb-webhook`
5. Enter the Webhook Token you generated in Step 2
6. Select entities to monitor:
   - ✅ Purchase
   - ✅ Bill
   - ✅ Expense
   - ✅ Payment
   - ✅ Invoice
   - ✅ SalesReceipt
7. Save the webhook

## Step 5: Test the Webhook

### Option A: Use Intuit's Test Tool
1. In the Intuit Developer Portal → Webhooks
2. Click "Test" next to your webhook
3. Check Netlify Functions logs to see if it received the test

### Option B: Create a Real Transaction
1. Log into your QuickBooks Online account
2. Create a test expense or purchase
3. Within a few seconds, check your Supabase `transactions` table
4. You should see a new transaction with `source='quickbooks'` and `assigned=false`

## Step 6: Verify in Fleet OS

1. Open your Fleet OS application
2. Go to the Transactions tab
3. You should see new unassigned transactions from QuickBooks
4. Click "Assign" to link them to specific cars

## Webhook Behavior

- **New transactions** are automatically created with `assigned=false`
- **Updated transactions** in QB will update the existing record
- **Deleted transactions** in QB will be removed from Fleet OS
- All transactions include the full QB data in `raw_data` field for reference

## Troubleshooting

### Webhook not receiving data
- Check Netlify Functions logs: Site → Functions → qb-webhook
- Verify environment variables are set correctly
- Ensure webhook token matches between Netlify and Intuit portal

### Signature verification failing
- Double-check the `QB_WEBHOOK_TOKEN` matches exactly
- Ensure no extra spaces or characters

### Transactions not appearing
- Check Supabase logs for errors
- Verify `SUPABASE_SERVICE_KEY` has write permissions
- Check that the `transactions` table has the new columns

### Access token expired
- QB tokens expire after 1 hour
- You'll need to implement token refresh (see next steps below)

## Next Steps: Token Refresh

The webhook needs a valid QB access token to fetch transaction details. You'll need to:

1. Store the refresh token when users connect QB
2. Implement automatic token refresh before API calls
3. Handle token expiration gracefully

Would you like me to implement the token refresh logic as well?

## Support

For issues with:
- **QuickBooks API**: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/purchase
- **Netlify Functions**: https://docs.netlify.com/functions/overview/
- **Supabase**: https://supabase.com/docs
