# Installation Instructions

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account
- QuickBooks Developer account
- Netlify account (or similar hosting)

---

## Step 1: Install Dependencies

```bash
cd "Fleet OS"
npm install
```

This will install:
- `@supabase/supabase-js@^2.39.0` - Supabase client library
- `@netlify/functions@^2.4.0` - Netlify Functions SDK
- `typescript@^5.3.0` - TypeScript compiler
- `@types/node@^20.10.0` - Node.js type definitions
- `netlify-cli@^17.10.0` - Netlify CLI tools

**Note**: TypeScript errors in the IDE will resolve after running `npm install`.

---

## Step 2: TypeScript Compilation

Verify TypeScript compiles without errors:

```bash
npm run type-check
```

Expected output:
```
✓ No TypeScript errors found
```

---

## Step 3: Environment Setup

Copy the environment template:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```bash
# Supabase
SUPABASE_URL=https://hnypmigzwfavwcwarmnk.supabase.co
SUPABASE_SERVICE_KEY=your_actual_service_key
SUPABASE_ANON_KEY=your_actual_anon_key

# QuickBooks
QB_CLIENT_ID=your_actual_client_id
QB_CLIENT_SECRET=your_actual_client_secret
QB_ENVIRONMENT=sandbox
QB_WEBHOOK_TOKEN=$(openssl rand -base64 32)

# Netlify
URL=http://localhost:8888
```

---

## Step 4: Database Migration

1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Create new query
4. Copy contents of `supabase/migrations/002_quickbooks_integration.sql`
5. Paste and execute

Verify tables created:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'quickbooks_connections',
  'financial_accounts',
  'webhook_events',
  'notifications',
  'sync_jobs',
  'transaction_categories'
);
```

---

## Step 5: Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "New Bucket"
3. Name: `receipts`
4. Public: **No** (keep private)
5. File size limit: 10MB
6. Allowed MIME types:
   - `image/jpeg`
   - `image/png`
   - `application/pdf`

---

## Step 6: Local Development

Start the local development server:

```bash
npm run dev
```

This starts:
- Static file server on http://localhost:8888
- Netlify Functions on http://localhost:8888/.netlify/functions/*

Test endpoints:
- http://localhost:8888/files/transactions-unassigned.html
- http://localhost:8888/.netlify/functions/qb-connect?accountId=1

---

## Step 7: QuickBooks App Setup

### Create App

1. Go to https://developer.intuit.com/
2. Click "My Apps" → "Create an app"
3. Select "QuickBooks Online and Payments"
4. Name: "Fleet OS Integration"

### Configure OAuth

1. Go to "Keys & OAuth"
2. Copy Client ID and Client Secret
3. Add Redirect URIs:
   ```
   http://localhost:8888/.netlify/functions/qb-callback
   https://your-domain.netlify.app/.netlify/functions/qb-callback
   ```
4. Scopes: `com.intuit.quickbooks.accounting`

### Configure Webhook

1. Go to "Webhooks" tab
2. Add webhook URL:
   ```
   http://your-ngrok-url/.netlify/functions/qb-webhook  (for local)
   https://your-domain.netlify.app/.netlify/functions/qb-webhook  (for prod)
   ```
3. Enter webhook verifier token (from QB_WEBHOOK_TOKEN)
4. Select entities:
   - Purchase
   - Bill
   - Expense
   - Deposit
   - Payment
   - Invoice
   - SalesReceipt

---

## Step 8: Local Testing with ngrok

For testing webhooks locally:

```bash
# Install ngrok
brew install ngrok

# Expose local port
ngrok http 8888

# Copy the https URL (e.g., https://abc123.ngrok.io)
# Update QuickBooks webhook URL to:
# https://abc123.ngrok.io/.netlify/functions/qb-webhook
```

---

## Step 9: Deploy to Netlify

### Option A: CLI Deployment

```bash
# Login to Netlify
netlify login

# Initialize site
netlify init

# Deploy
npm run deploy
```

### Option B: GitHub Integration

1. Push code to GitHub
2. Go to Netlify Dashboard
3. "Add new site" → "Import an existing project"
4. Connect GitHub repository
5. Build settings:
   - Build command: `npm run build`
   - Publish directory: `files`
   - Functions directory: `netlify/functions`
6. Add environment variables
7. Deploy

---

## Step 10: Production Environment Variables

In Netlify Dashboard → Site Settings → Environment Variables:

```
SUPABASE_URL=https://hnypmigzwfavwcwarmnk.supabase.co
SUPABASE_SERVICE_KEY=your_production_service_key
SUPABASE_ANON_KEY=your_production_anon_key
QB_CLIENT_ID=your_qb_client_id
QB_CLIENT_SECRET=your_qb_client_secret
QB_ENVIRONMENT=production
QB_WEBHOOK_TOKEN=your_secure_webhook_token
URL=https://your-domain.netlify.app
```

---

## Verification

### 1. Check Dependencies

```bash
npm list --depth=0
```

Should show:
- @netlify/functions
- @supabase/supabase-js
- @types/node
- netlify-cli
- typescript

### 2. Check TypeScript

```bash
npm run type-check
```

Should complete without errors.

### 3. Check Functions

```bash
# Start dev server
npm run dev

# In another terminal, test functions
curl http://localhost:8888/.netlify/functions/qb-connect?accountId=1
```

Should return 302 redirect.

### 4. Check Database

```sql
-- In Supabase SQL Editor
SELECT COUNT(*) FROM quickbooks_connections;
SELECT COUNT(*) FROM financial_accounts;
SELECT COUNT(*) FROM webhook_events;
SELECT COUNT(*) FROM notifications;
SELECT COUNT(*) FROM transaction_categories;
```

All should return 0 (empty but tables exist).

### 5. Check Storage

In Supabase Dashboard → Storage:
- Bucket `receipts` should exist
- Should be private (not public)

---

## Troubleshooting

### TypeScript Errors

**Issue**: Cannot find module '@supabase/supabase-js'

**Fix**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Function Not Found

**Issue**: 404 on function endpoints

**Fix**:
- Verify functions are in `netlify/functions/` directory
- Check `netlify.toml` configuration
- Restart dev server

### Database Migration Failed

**Issue**: SQL errors during migration

**Fix**:
- Check if tables already exist
- Drop existing tables if needed
- Re-run migration
- Check Supabase logs

### Storage Bucket Error

**Issue**: Cannot upload to receipts bucket

**Fix**:
- Verify bucket exists
- Check bucket is private
- Verify MIME types configured
- Check Supabase Storage policies

---

## Next Steps

After successful installation:

1. ✅ Follow [QUICKBOOKS_SETUP.md](QUICKBOOKS_SETUP.md) for QuickBooks configuration
2. ✅ Connect QuickBooks in the app
3. ✅ Test transaction flow
4. ✅ Review [QUICKBOOKS_INTEGRATION_GUIDE.md](QUICKBOOKS_INTEGRATION_GUIDE.md) for details

---

## Common Commands

```bash
# Install dependencies
npm install

# Type check
npm run type-check

# Local development
npm run dev

# Deploy to production
npm run deploy

# View Netlify logs
netlify logs

# Open Netlify dashboard
netlify open
```

---

## System Requirements

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **OS**: macOS, Linux, or Windows
- **RAM**: 4GB minimum
- **Disk**: 500MB for dependencies

---

## Support

If you encounter issues during installation:

1. Check this troubleshooting guide
2. Review error messages carefully
3. Check Netlify function logs
4. Verify environment variables
5. Test with sandbox environment first

---

**Installation Time**: ~15 minutes  
**Difficulty**: Intermediate  
**Prerequisites**: Node.js, npm, basic terminal knowledge
