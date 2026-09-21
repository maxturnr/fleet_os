# FleetOS v3 - Fresh Start (5 Minutes)

## ✨ Brand New, Clean Build

I've created a completely fresh version with ZERO legacy code.

## 🚀 Setup (3 Steps)

### Step 1: Database Setup (2 minutes)

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to **SQL Editor** → **New Query**
3. Copy **ALL** of `files/CLEAN_DATABASE_SETUP.sql`
4. Click **RUN** ▶️
5. You should see: "Setup Complete!"

### Step 2: Create Auth User (1 minute)

1. Go to **Authentication** → **Users**
2. Click **Add User**
3. Fill in:
   - Email: `max@thgautomotive.com`
   - Password: (choose one)
   - Auto Confirm: ✅ **YES**
4. Click **Create User**
5. **COPY THE USER ID** (the UUID)

### Step 3: Link User to Account (30 seconds)

1. Go back to **SQL Editor** → **New Query**
2. Paste this (replace UUID):
   ```sql
   UPDATE accounts 
   SET user_id = 'PASTE-YOUR-UUID-HERE'::uuid
   WHERE dealer_name = 'THG Automotive';
   ```
3. Click **RUN**

## ✅ Test Login

Open `files/FleetOS_v3_CLEAN.html` in your browser and login!

## 📁 Files

- **`FleetOS_v3_CLEAN.html`** - Brand new, clean login page
- **`CLEAN_DATABASE_SETUP.sql`** - Simple database setup

## 🎯 What's Different?

- ✅ No legacy code
- ✅ No old `users` table references
- ✅ Simple, clean authentication
- ✅ Only 200 lines of code
- ✅ Easy to understand and extend

## 🔄 Next Steps After Login Works

Once you can login successfully, we'll add:
1. Car inventory management
2. Transaction tracking
3. P&L reports
4. All the features you want

But first, let's get login working with this clean build!
