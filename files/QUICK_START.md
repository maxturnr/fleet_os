# FleetOS Authentication - Quick Start

## ✅ Your Login Page is Ready!

The login functionality is **already implemented** in `FleetOS_v2.html`. You just need to complete the database setup.

## 🚀 3-Step Setup

### Step 1: Create User in Supabase (2 minutes)

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to **Authentication** → **Users**
3. Click **Add User**
4. Enter:
   - Email: `max@thgautomotive.com`
   - Password: (your password)
   - Auto Confirm: ✅ **YES**
5. Click **Create User**
6. **Copy the User ID** (looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### Step 2: Run Migration SQL (1 minute)

1. Go to **SQL Editor** → **New Query**
2. Paste the contents of `SUPABASE_AUTH_MIGRATION.sql`
3. Click **Run**

### Step 3: Link User to Account (30 seconds)

1. In **SQL Editor**, run this (replace the UUID):

```sql
UPDATE accounts 
SET user_id = 'PASTE-YOUR-USER-ID-HERE'::uuid
WHERE dealer_name = 'THG Automotive';
```

## ✨ Done! Test Login

1. Open `FleetOS_v2.html` in browser
2. Email: `max@thgautomotive.com`
3. Password: (what you set in Step 1)
4. Click **Sign In**

## 🔍 Verify Setup

Run `VERIFY_AUTH_SETUP.sql` to check everything is configured correctly.

## 📚 Full Documentation

See `AUTH_SETUP_GUIDE.md` for complete details and troubleshooting.

## 🎯 What You Get

✅ Secure email/password login  
✅ Session persistence (stays logged in)  
✅ Automatic data filtering by dealership  
✅ Logout functionality  
✅ Password reset capability (via Supabase)  

## 🆘 Troubleshooting

**"No active account found"**
→ Run Step 3 again with correct UUID

**"Invalid credentials"**
→ Check email/password, ensure user is confirmed

**Can login but no data shows**
→ Run this to link data:
```sql
UPDATE cars SET account_id = 1 WHERE account_id IS NULL;
UPDATE transactions SET account_id = 1 WHERE account_id IS NULL;
```

## 📞 Need Help?

Check `VERIFY_AUTH_SETUP.sql` for diagnostic queries.
