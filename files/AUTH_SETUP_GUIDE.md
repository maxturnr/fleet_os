# FleetOS Supabase Authentication Setup Guide

## ✅ Current Status

Your login page is **already configured** to work with Supabase OAuth using email and password authentication. The code is complete and ready to use.

## 🔧 Required Setup Steps

### Step 1: Run the Auth Migration SQL

1. Open Supabase Dashboard
2. Go to **SQL Editor** → **New Query**
3. Copy and paste the contents of `SUPABASE_AUTH_MIGRATION.sql`
4. Click **Run**

This will:
- Drop the old custom `users` table
- Add `user_id` column to `accounts` table (links to Supabase Auth)
- Add `primary_email` and `primary_user_name` columns
- Create necessary indexes

### Step 2: Create User in Supabase Auth

1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Click **Add User** (or **Invite User**)
3. Fill in:
   - **Email**: `max@thgautomotive.com`
   - **Password**: (choose a secure password)
   - **Auto Confirm User**: ✅ YES (important!)
4. Click **Create User**
5. **Copy the User ID (UUID)** - you'll need this in the next step

### Step 3: Link the Auth User to Your Account

1. Go to **SQL Editor** → **New Query**
2. Run this query (replace `YOUR-USER-UUID-HERE` with the UUID from Step 2):

```sql
UPDATE accounts 
SET user_id = 'YOUR-USER-UUID-HERE'::uuid
WHERE dealer_name = 'THG Automotive';
```

3. Verify the link worked:

```sql
SELECT 
  a.id as account_id,
  a.dealer_name,
  a.user_id,
  a.primary_email,
  au.email as auth_email
FROM accounts a
LEFT JOIN auth.users au ON au.id = a.user_id
WHERE a.dealer_name = 'THG Automotive';
```

You should see your account with the `user_id` populated and matching `auth_email`.

### Step 4: Test Login

1. Open `FleetOS_v2.html` in your browser
2. Enter your email: `max@thgautomotive.com`
3. Enter the password you set in Step 2
4. Click **Sign In**

## 🔐 How Authentication Works

### Login Flow:

1. **User enters credentials** → Email & password
2. **Supabase Auth validates** → Checks against `auth.users` table
3. **App fetches account** → Queries `accounts` table by `user_id`
4. **Data is filtered** → All queries use `account_id` to show only your dealership's data

### Code Reference (FleetOS_v2.html):

```javascript
// Lines 757-816: Login function
async function doLogin(){
  // 1. Sign in with Supabase Auth
  const {data: authData, error: authError} = await sb.auth.signInWithPassword({
    email,
    password
  })
  
  // 2. Get account info linked to this user
  const {data: accounts, error: accountError} = await sb
    .from('accounts')
    .select('*')
    .eq('user_id', authData.user.id)  // ← Links auth user to account
    .eq('active', true)
    .single()
  
  // 3. Store session and load dealership data
  currentUser = {
    id: authData.user.id,
    email: authData.user.email,
    account_id: accounts.id,
    dealer_name: accounts.dealer_name
  }
  accountId = accounts.id
}
```

### Data Filtering:

All data queries are automatically filtered by `account_id`:

```javascript
// Lines 938-943: Load dealership data
await sb.from('cars').select('*').eq('account_id', accountId)
await sb.from('transactions').select('*').eq('account_id', accountId)
await sb.from('balance_sheet').select('*').eq('account_id', accountId)
await sb.from('settings').select('*').eq('account_id', accountId)
```

## 🎯 What Happens After Login

1. ✅ User is authenticated via Supabase Auth
2. ✅ Account is loaded based on `user_id`
3. ✅ All cars, transactions, and settings are filtered by `account_id`
4. ✅ Only data for "THG Automotive" dealership is shown
5. ✅ Session persists across page refreshes
6. ✅ User can log out to clear session

## 🔍 Troubleshooting

### "No active account found for this user"

**Cause**: The `user_id` in the `accounts` table doesn't match the auth user's ID.

**Fix**: Run Step 3 again with the correct UUID.

### "Invalid login credentials"

**Cause**: Email or password is incorrect, or user doesn't exist in Supabase Auth.

**Fix**: 
- Verify user exists in **Authentication** → **Users**
- Check email is confirmed (should have a green checkmark)
- Reset password if needed

### User can login but sees no data

**Cause**: The `account_id` on existing data is NULL or incorrect.

**Fix**: Run this to link existing data:

```sql
-- Get your account_id
SELECT id FROM accounts WHERE dealer_name = 'THG Automotive';

-- Update all data (replace 1 with your account_id)
UPDATE cars SET account_id = 1 WHERE account_id IS NULL;
UPDATE transactions SET account_id = 1 WHERE account_id IS NULL;
UPDATE balance_sheet SET account_id = 1 WHERE account_id IS NULL;
UPDATE settings SET account_id = 1 WHERE account_id IS NULL;
```

## 📊 Database Schema

### accounts table:
- `id` - Primary key
- `dealer_name` - Name of the dealership
- `user_id` - **Links to auth.users(id)** ← This is the key field
- `primary_email` - Email for reference
- `primary_user_name` - Name for reference
- `active` - Whether account is active

### auth.users table (Supabase managed):
- `id` - UUID primary key
- `email` - User's email
- `encrypted_password` - Hashed password
- `email_confirmed_at` - Confirmation timestamp
- `last_sign_in_at` - Last login time

## 🚀 Next Steps

After authentication is working:

1. **Add more users**: Create additional users in Supabase Auth and link them to the same `account_id`
2. **Add more dealerships**: Create new accounts and new auth users for other dealerships
3. **Set up Row Level Security (RLS)**: Enable RLS policies to enforce data isolation at the database level

## 📝 Notes

- The old `users` table with password hashes has been removed
- All authentication is now handled by Supabase Auth (more secure)
- Sessions are managed automatically by Supabase
- Password reset flows can be configured in Supabase Auth settings
