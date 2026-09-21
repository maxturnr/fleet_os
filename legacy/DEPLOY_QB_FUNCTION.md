# Deploy QuickBooks Token Exchange Function

This edge function is required for proper QuickBooks OAuth authentication.

## Prerequisites

1. Install Supabase CLI:
```bash
brew install supabase/tap/supabase
```

2. Login to Supabase:
```bash
supabase login
```

## Deploy the Function

1. Link your project:
```bash
supabase link --project-ref hnypmigzwfavwcwarmnk
```

2. Set your QuickBooks Client Secret:
```bash
supabase secrets set QB_CLIENT_SECRET=your_quickbooks_client_secret_here
```

3. Deploy the function:
```bash
supabase functions deploy qb-token-exchange
```

## Get Your QB Client Secret

1. Go to https://developer.intuit.com/app/developer/myapps
2. Click on your app
3. Go to "Keys & OAuth" tab
4. Copy the "Client Secret"
5. Use it in step 2 above

## Test

After deployment, try connecting QuickBooks from your app. It should now properly exchange tokens and show your real company ID instead of "demo mode".
