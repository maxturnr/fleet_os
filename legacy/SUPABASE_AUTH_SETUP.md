# Supabase Auth Setup Guide

## Step 1: Run SQL Migration

In Supabase SQL Editor, run `files/SUPABASE_AUTH_MIGRATION.sql`

This will:
- Drop the old custom `users` table
- Add `user_id` to `accounts` table
- Link accounts to Supabase Auth users

## Step 2: Create User in Supabase Auth

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Fill in:
   - **Email:** max@thgautomotive.com
   - **Password:** (create a secure password)
   - **Auto Confirm User:** ✅ YES (check this box)
4. Click "Create user"
5. **Copy the User ID** (UUID format like: `a1b2c3d4-...`)

## Step 3: Link User to Account

In Supabase SQL Editor, run:

```sql
-- Replace <USER_ID> with the UUID you copied
UPDATE accounts 
SET user_id = '<USER_ID>'
WHERE dealer_name = 'THG Automotive';

-- Verify
SELECT 
  id,
  dealer_name,
  user_id,
  primary_email
FROM accounts
WHERE dealer_name = 'THG Automotive';
```

## Step 4: Test Login

1. Go to https://fleet-os-nine.vercel.app/
2. Log in with:
   - Email: max@thgautomotive.com
   - Password: (the password you set in Step 2)

## Password Reset

If you forget your password:

1. Go to Supabase Dashboard → Authentication → Users
2. Find your user
3. Click "..." → "Send password recovery"
4. Check your email for reset link

OR

1. In Supabase Dashboard → Authentication → Users
2. Find your user
3. Click "..." → "Reset password"
4. Set a new password directly

## Benefits of Supabase Auth

✅ Built-in password reset via email
✅ Email verification
✅ Secure password hashing (bcrypt)
✅ Session management
✅ Magic links
✅ OAuth providers (Google, GitHub, etc.) - can add later
✅ Multi-factor authentication - can add later

## Adding More Users (Future)

1. Supabase Dashboard → Authentication → Users → Add user
2. Create the user
3. Link to account:
   ```sql
   UPDATE accounts 
   SET user_id = '<NEW_USER_ID>'
   WHERE dealer_name = 'THG Automotive';
   ```

## Multi-User Support (Future)

To support multiple users per account, you'll need to:
1. Change `user_id` in accounts to allow multiple
2. Create a junction table `account_users`
3. Add role management

For now, one user per account is sufficient.
