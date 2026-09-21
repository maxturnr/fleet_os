# Fleet OS v2 - Profit & Loss Tracker

A comprehensive fleet management system with QuickBooks integration for automatic transaction syncing.

## Features

- **Owned Stock Management** - Track purchased vehicles with full P&L calculations
- **Sale or Return (SOR)** - Manage consignment vehicles with commission tracking
- **Transaction Management** - Manual entry + automatic QuickBooks sync
- **QuickBooks Integration** - Real-time webhook for automatic transaction imports
- **P&L Reporting** - Comprehensive profit/loss analysis with tax calculations
- **Balance Sheet** - Track assets, liabilities, and working capital

## Tech Stack

- **Frontend**: Single-page HTML application (vanilla JS)
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Netlify (static site + serverless functions)
- **Integration**: QuickBooks Online API with webhooks

## Project Structure

```
Fleet OS/
├── files/
│   ├── FleetOS_v2.html          # Main application
│   └── migration.sql             # Database schema
├── netlify/
│   └── functions/
│       └── qb-webhook.js         # QuickBooks webhook handler
├── package.json                  # Dependencies
├── netlify.toml                  # Netlify configuration
├── .env.example                  # Environment variables template
├── WEBHOOK_SETUP.md              # Detailed webhook setup guide
└── README.md                     # This file
```

## Quick Start

### 1. Database Setup

1. Create a Supabase project at https://supabase.com
2. Run the SQL migration in `files/migration.sql` via Supabase SQL Editor
3. Note your Supabase URL and service role key

### 2. QuickBooks App Setup

1. Go to https://developer.intuit.com/
2. Create a new app or use existing
3. Add your domain to Redirect URIs
4. Note your Client ID and Client Secret
5. Generate a webhook verifier token (random string)

### 3. Local Development

```bash
# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env

# Edit .env with your credentials
# SUPABASE_URL, SUPABASE_SERVICE_KEY, QB_CLIENT_SECRET, QB_WEBHOOK_TOKEN

# Start local dev server
npm run dev
```

### 4. Deploy to Netlify

#### Option A: CLI Deployment
```bash
npm run deploy
```

#### Option B: GitHub Integration
1. Push code to GitHub
2. Connect repo to Netlify
3. Set environment variables in Netlify dashboard
4. Deploy automatically on push

### 5. Configure QuickBooks Webhook

See `WEBHOOK_SETUP.md` for detailed instructions.

**Quick version:**
1. Go to Intuit Developer Portal → Your App → Webhooks
2. Add webhook URL: `https://your-site.netlify.app/.netlify/functions/qb-webhook`
3. Enter your webhook token
4. Select entities: Purchase, Bill, Expense, Payment, Invoice, SalesReceipt
5. Save and test

## Environment Variables

Required in Netlify (Site Settings → Environment Variables):

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
QB_CLIENT_ID=your_qb_client_id
QB_CLIENT_SECRET=your_qb_client_secret
QB_WEBHOOK_TOKEN=your_random_webhook_token
QB_ENVIRONMENT=sandbox  # or 'production'
```

## How It Works

### QuickBooks Integration Flow

1. **User connects QB** - OAuth flow stores access/refresh tokens in Supabase
2. **Transaction created in QB** - QuickBooks sends webhook notification
3. **Webhook receives event** - Netlify function validates signature
4. **Fetch transaction details** - Function calls QB API for full data
5. **Store in database** - Transaction saved with `source='quickbooks'` and `assigned=false`
6. **User assigns transaction** - In Fleet OS UI, user links transaction to specific car or marks as overhead
7. **P&L updates** - Profit calculations automatically include assigned costs

### Transaction Assignment

Unassigned QuickBooks transactions appear with a warning badge:
- Click "Assign" button next to transaction
- Search for car by registration, stock number, or make/model
- Select car to link transaction
- Or mark as "Overhead" for general business expenses

### Supported QB Transaction Types

- **Purchase** - Direct purchases with payment
- **Bill** - Invoices from vendors
- **Expense** - General expenses
- **Payment** - Customer payments received
- **Invoice** - Sales invoices
- **SalesReceipt** - Direct sales receipts

## Database Schema

### `cars` table
- Stores both owned and SOR vehicles
- `type` field: 'owned' or 'sor'
- Tracks purchase/sale dates, prices, fees
- Links to transactions via `stock_id`

### `transactions` table
- Manual and QuickBooks transactions
- `source`: 'manual' or 'quickbooks'
- `assigned`: boolean - whether linked to car or marked as overhead
- `stock_id`: foreign key to cars table
- `qb_id`: unique QB transaction identifier
- `raw_data`: full QB transaction JSON

### `settings` table
- Key-value store for app configuration
- Stores QB tokens and connection status

### `balance_sheet` table
- Tracks assets and liabilities
- Updated manually via UI

## Troubleshooting

### Webhook not receiving data
- Check Netlify Functions logs
- Verify webhook token matches
- Test webhook in Intuit Developer Portal

### Transactions not appearing
- Check Supabase logs for errors
- Verify service key has write permissions
- Ensure database migration ran successfully

### QB connection expires
- Access tokens expire after 1 hour
- Refresh tokens valid for 100 days
- Re-connect QB if refresh token expires

## Security Notes

- Never commit `.env` file
- Use Supabase service role key (not anon key) for webhook function
- Keep QB client secret secure
- Webhook token should be random and strong
- Consider enabling Supabase RLS for production

## Future Enhancements

- [ ] Automatic token refresh for QB API
- [ ] Email notifications for unassigned transactions
- [ ] Bulk transaction assignment
- [ ] Export reports to PDF
- [ ] Multi-user support with roles
- [ ] Mobile app version

## Support

For issues or questions:
- QuickBooks API: https://developer.intuit.com/app/developer/qbo/docs
- Supabase: https://supabase.com/docs
- Netlify Functions: https://docs.netlify.com/functions/overview/

## License

Private - Internal use only
