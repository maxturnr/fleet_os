# FleetOS Database Setup - Correct Order

## ❌ Problem: 404 Error on Login

The `accounts` table doesn't exist yet in your Supabase database.

## ✅ Solution: Run SQL Files in This Order

### Step 1: Create Base Tables (REQUIRED FIRST)

Run `accounts_migration.sql` to create:
- `accounts` table
- `users` table (will be replaced later)
- Add `account_id` to existing tables

**Go to Supabase → SQL Editor → New Query → Paste and Run**

### Step 2: Run Auth Migration

Run `SUPABASE_AUTH_MIGRATION.sql` to:
- Drop old `users` table
- Add `user_id` column to `accounts`
- Link to Supabase Auth

### Step 3: Create User in Supabase Auth UI

1. Go to **Authentication** → **Users**
2. Click **Add User**
3. Email: `max@thgautomotive.com`
4. Password: (your choice)
5. Auto Confirm: ✅ YES
6. **Copy the User ID (UUID)**

### Step 4: Link User to Account

Run this in SQL Editor (replace UUID):

```sql
UPDATE accounts 
SET user_id = 'YOUR-USER-UUID-HERE'::uuid
WHERE dealer_name = 'THG Automotive';
```

### Step 5: Verify Setup

Run `VERIFY_AUTH_SETUP.sql` to check everything.

### Step 6: Test Login

Open `FleetOS_v2.html` and login!

## 🔍 Current Error Explanation

```
Failed to load resource: 404
```

This happens at line 780 in FleetOS_v2.html:
```javascript
const {data: accounts, error: accountError} = await sb
  .from('accounts')  // ← This table doesn't exist yet!
```

The app is trying to query the `accounts` table, but it hasn't been created in your Supabase database.

## 📋 Quick Fix Checklist

- [ ] Run `accounts_migration.sql` (creates accounts table)
- [ ] Run `SUPABASE_AUTH_MIGRATION.sql` (adds user_id column)
- [ ] Create user in Supabase Auth UI
- [ ] Link user_id to account
- [ ] Test login

## ⚠️ Important Notes

- **DO NOT** run `ONE_TIME_SETUP.sql` - it's outdated and uses the old users table
- The correct flow is: accounts_migration.sql → SUPABASE_AUTH_MIGRATION.sql → Create Auth User → Link
