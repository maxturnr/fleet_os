# QuickBooks Webhook Setup

Webhooks allow QuickBooks to notify your app when data changes in real-time.

## 1. Deploy the Webhook Function

```bash
supabase functions deploy qb-webhook
```

## 2. Get Your Webhook URL

Your webhook endpoint will be:
```
https://hnypmigzwfavwcwarmnk.supabase.co/functions/v1/qb-webhook
```

## 3. Configure in QuickBooks Developer Portal

1. Go to https://developer.intuit.com/app/developer/myapps
2. Click on your app
3. Go to **"Webhooks"** section
4. Click **"Add Webhook"**
5. Enter the webhook URL above
6. Select events to subscribe to:
   - **Purchase** - Create, Update, Delete
   - **Account** - Create, Update, Delete
   - **Vendor** - Create, Update, Delete
7. Click **"Save"**

## 4. Test the Webhook

QuickBooks will send a test payload. Your function should respond with:
```json
{"success": true, "processed": 0}
```

## 5. What It Does

When data changes in QuickBooks:
- New purchase → Logs the event (you can trigger auto-sync)
- New bank account → Logs the event
- Any changes → Captured in real-time

## Optional: Auto-Sync on Webhook

You can modify the webhook function to automatically trigger a sync when new transactions are created, keeping your app always up-to-date!

## Webhook URL for QB Settings

**Webhook Endpoint**: `https://hnypmigzwfavwcwarmnk.supabase.co/functions/v1/qb-webhook`

**Or with custom domain** (once set up):
`https://www.pierfront.co/api/qb-webhook` (requires Vercel routing)
