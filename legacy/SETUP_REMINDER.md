# 🔧 Database Setup Reminder

## ⚠️ Important: Run These SQL Scripts

To enable all features, you need to run these SQL scripts in your Supabase SQL Editor:

### 1. ✅ Split Costs Feature
**File:** `files/ADD_SPLIT_COSTS.sql`

**What it does:**
- Creates `transaction_splits` table
- Enables splitting transaction costs across multiple cars

**Status:** Run this if you want to use split costs

---

### 2. ✅ Document Upload Feature
**File:** `files/ADD_DOCUMENT_STORAGE.sql`

**What it does:**
- Creates `transaction_documents` table
- Enables uploading receipts/invoices

**Additional Step:**
- Go to Supabase Storage
- Create bucket: `transaction-documents`
- Set to PUBLIC

**Status:** Run this if you want to upload documents

---

## 🚀 How to Run

### In Supabase Dashboard:

1. Go to **SQL Editor**
2. Click **New Query**
3. Copy contents from the SQL file
4. Click **Run**
5. Check for success message

### Quick Links:

- Split Costs: `files/ADD_SPLIT_COSTS.sql`
- Documents: `files/ADD_DOCUMENT_STORAGE.sql`

---

## ✨ Features Status

| Feature | SQL Required | Storage Required | Status |
|---------|-------------|------------------|--------|
| Basic Transactions | ✅ Built-in | ❌ No | Ready |
| Split Costs | ⚠️ ADD_SPLIT_COSTS.sql | ❌ No | Optional |
| Document Upload | ⚠️ ADD_DOCUMENT_STORAGE.sql | ⚠️ Create bucket | Optional |
| Vehicle Purchase | ✅ Built-in | ❌ No | Ready |

---

## 💡 Notes

- **App works without these tables** - they're optional features
- **No errors if tables don't exist** - app handles gracefully
- **Run when you need the features** - not required immediately
- **Safe to run anytime** - won't affect existing data

---

## 🔍 Check If Already Run

In Supabase SQL Editor, run:

```sql
-- Check for split costs table
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'transaction_splits'
);

-- Check for documents table
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'transaction_documents'
);
```

Returns `true` if table exists, `false` if not.

---

**The app is fully functional without these - they just add extra features!** ✨
