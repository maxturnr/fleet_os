# Deployment Checklist

Follow these steps to deploy your Fleet OS with QuickBooks webhook integration.

## ☐ Step 1: Update Database

- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Run the updated `files/migration.sql`
- [ ] Verify new columns exist:
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'transactions' 
  AND column_name IN ('qb_id', 'qb_type', 'raw_data');
  ```
- [ ] Verify settings table has QB keys:
  ```sql
  SELECT key FROM settings WHERE key LIKE 'qb_%';
  ```

## ☐ Step 2: Get Your Credentials

### Supabase
- [ ] Go to Project Settings → API
- [ ] Copy `service_role` key (NOT anon key)
- [ ] Note your project URL

### QuickBooks
- [ ] Go to https://developer.intuit.com/
- [ ] Navigate to your app → Keys & credentials
- [ ] Copy Client ID (already in your HTML)
- [ ] Copy Client Secret
- [ ] Generate webhook token: `openssl rand -base64 32`
- [ ] Save all three values

## ☐ Step 3: Install Dependencies

```bash
cd "/Users/maxturner/Library/Mobile Documents/com~apple~CloudDocs/Documents/THG/Fleet OS"
npm install
```

## ☐ Step 4: Deploy to Netlify

### Option A: Netlify CLI (Recommended)

```bash
# Login to Netlify
npx netlify login

# Link to existing site or create new
npx netlify link

# Set environment variables
npx netlify env:set SUPABASE_URL "https://hnypmigzwfavwcwarmnk.supabase.co"
npx netlify env:set SUPABASE_SERVICE_KEY "your_service_role_key_here"
npx netlify env:set QB_CLIENT_ID "ABcPoVXTxYiF0DTS1XHFuh9NJMYamffDlLGFPIq155E5ZdPIXZ"
npx netlify env:set QB_CLIENT_SECRET "your_client_secret_here"
npx netlify env:set QB_WEBHOOK_TOKEN "your_webhook_token_here"
npx netlify env:set QB_ENVIRONMENT "sandbox"

# Deploy
npx netlify deploy --prod
```

### Option B: Netlify Dashboard

- [ ] Go to https://app.netlify.com/
- [ ] Click "Add new site" → "Import an existing project"
- [ ] Connect to GitHub (push your code first)
- [ ] Build settings:
  - Build command: (leave empty)
  - Publish directory: `files`
  - Functions directory: `netlify/functions`
- [ ] Go to Site settings → Environment variables
- [ ] Add all variables from Step 2
- [ ] Deploy site

## ☐ Step 5: Note Your Netlify URL

After deployment:
- [ ] Copy your site URL (e.g., `https://fleet-os-abc123.netlify.app`)
- [ ] Test the site loads correctly
- [ ] Verify you can log in (admin / fleet2024)

## ☐ Step 6: Update QuickBooks Redirect URI

- [ ] Go to https://developer.intuit.com/
- [ ] Your app → Keys & credentials → Redirect URIs
- [ ] Add your Netlify URL (e.g., `https://fleet-os-abc123.netlify.app/FleetOS_v2.html`)
- [ ] Save changes

## ☐ Step 7: Configure QuickBooks Webhook

- [ ] Go to https://developer.intuit.com/
- [ ] Your app → Webhooks
- [ ] Click "Add webhook" or edit existing
- [ ] Webhook URL: `https://your-site.netlify.app/.netlify/functions/qb-webhook`
- [ ] Webhook token: (paste the token you generated in Step 2)
- [ ] Select entities to monitor:
  - [x] Purchase
  - [x] Bill
  - [x] Expense
  - [x] Payment
  - [x] Invoice
  - [x] SalesReceipt
- [ ] Save webhook configuration

## ☐ Step 8: Test Webhook

### Test 1: Intuit Test Tool
- [ ] In Intuit Developer Portal → Webhooks
- [ ] Click "Test" button next to your webhook
- [ ] Should see "200 OK" response
- [ ] Check Netlify Functions logs: Site → Functions → qb-webhook

### Test 2: Real Transaction
- [ ] Log into QuickBooks Online (sandbox or production)
- [ ] Create a test expense (e.g., £50 for "Test Supplier")
- [ ] Wait 10-30 seconds
- [ ] Check Netlify function logs for webhook received
- [ ] Check Supabase transactions table:
  ```sql
  SELECT * FROM transactions WHERE source = 'quickbooks' ORDER BY created_at DESC LIMIT 1;
  ```
- [ ] Should see new transaction with `assigned = false`

## ☐ Step 9: Test in Fleet OS

- [ ] Open your Fleet OS site
- [ ] Log in (admin / fleet2024)
- [ ] Go to Transactions tab
- [ ] Should see warning: "⚠ X QuickBooks transactions need assigning"
- [ ] Click "View Unassigned"
- [ ] See your test transaction with red background
- [ ] Click "Assign →" button
- [ ] Search for a car or click "Mark as Overhead"
- [ ] Verify transaction is now assigned

## ☐ Step 10: Connect QuickBooks OAuth

- [ ] In Fleet OS, click "Connect QuickBooks" button
- [ ] Complete OAuth flow
- [ ] Should redirect back to Fleet OS
- [ ] Green badge should show "QB Connected"

## Troubleshooting

### Webhook returns 401 Unauthorized
- Check webhook token matches exactly in both Netlify and Intuit
- No extra spaces or line breaks

### Webhook returns 500 Error
- Check Netlify function logs for specific error
- Verify SUPABASE_SERVICE_KEY is set correctly
- Ensure database migration completed

### Transactions not appearing in Fleet OS
- Check Supabase transactions table directly
- Verify `assigned` column exists and is boolean
- Check browser console for errors

### "QB edge function not deployed yet" error
- This is expected - you're using Netlify functions instead
- Ignore this message, the webhook handles everything

## Post-Deployment

- [ ] Test creating transactions in QuickBooks
- [ ] Verify they appear in Fleet OS within 30 seconds
- [ ] Test assigning transactions to cars
- [ ] Test marking transactions as overhead
- [ ] Check P&L report includes assigned costs
- [ ] Set up monitoring for webhook failures (optional)

## Production Checklist

When moving from sandbox to production:

- [ ] Change `QB_ENVIRONMENT` to `production`
- [ ] Update QuickBooks app to production keys
- [ ] Re-configure webhook with production URL
- [ ] Test with real transactions
- [ ] Set up regular database backups
- [ ] Consider enabling Supabase RLS
- [ ] Set up error alerting (e.g., Sentry)

## Need Help?

Check these resources:
- `WEBHOOK_SETUP.md` - Detailed webhook guide
- `README.md` - Full project documentation
- Netlify Functions logs - Real-time debugging
- Supabase logs - Database query monitoring
- QuickBooks API docs - https://developer.intuit.com/

---

**Estimated time:** 30-45 minutes for first deployment
