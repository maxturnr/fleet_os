# 🔧 Fix Login 404 Error - RIGHT NOW

## ❌ Your Error:
```
Failed to load resource: 404
Login error: Object
```

## ✅ The Fix (5 minutes):

### Step 1: Create Database Tables (2 minutes)

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **SQL Editor** → **New Query**
3. Copy ALL contents from `FIX_404_ERROR.sql` (the FIXED version)
4. Click **RUN** ▶️
5. You should see: "Tables Created: 5"

**Note**: The script has been fixed to avoid the `ON CONFLICT` error. It's now safe to run multiple times.

### Step 2: Create Auth User (1 minute)

1. Click **Authentication** → **Users**
2. Click **Add User**
3. Fill in:
   ```
   Email: max@thgautomotive.com
   Password: (choose a strong password)
   Auto Confirm User: ✅ CHECK THIS BOX
   ```
4. Click **Create User**
5. **COPY THE USER ID** (looks like: `a1b2c3d4-5678-90ab-cdef-1234567890ab`)

### Step 3: Link User to Account (1 minute)

1. Go back to **SQL Editor** → **New Query**
2. Paste this (replace the UUID with yours from Step 2):
   ```sql
   UPDATE accounts 
   SET user_id = 'PASTE-YOUR-UUID-HERE'::uuid
   WHERE dealer_name = 'THG Automotive';
   ```
3. Click **RUN** ▶️
4. Should show: "Success. 1 row updated."

### Step 4: Test Login (30 seconds)

1. Open `FleetOS_v2.html` in your browser
2. Email: `max@thgautomotive.com`
3. Password: (what you set in Step 2)
4. Click **Sign In**
5. ✅ **You should be logged in!**

---

## 🔍 What Was Wrong?

The `accounts` table didn't exist in your database. When you tried to login, the app tried to query:

```javascript
sb.from('accounts').select('*')  // ← 404 error: table not found!
```

The `FIX_404_ERROR.sql` script creates all 5 required tables:
- ✅ `accounts` - Stores dealership info
- ✅ `cars` - Your vehicle inventory
- ✅ `transactions` - Costs and expenses
- ✅ `balance_sheet` - Financial balances
- ✅ `settings` - App settings

---

## 🆘 Still Getting Errors?

Run `CHECK_CURRENT_STATE.sql` to diagnose what's missing.

---

## ✨ After Login Works:

You can add cars, track transactions, and manage your dealership!
