# 🔧 Fix Document Upload Error

## ❌ Error: "new row violates row-level security policy"

This happens when the storage bucket has RLS enabled but no policies are set.

## ✅ Quick Fix (Choose One)

### Option 1: Disable RLS (Simplest)

**In Supabase Dashboard:**

1. Go to **Storage**
2. Click on **transaction-documents** bucket
3. Click **Configuration** tab
4. Find **"Row Level Security"**
5. Toggle it to **OFF** (disabled)
6. Click **Save**

**Done!** Uploads will work now.

---

### Option 2: Add RLS Policies (More Secure)

**In Supabase SQL Editor, run:**

```sql
-- Allow all authenticated users to upload
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'transaction-documents');

-- Allow all authenticated users to view
CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'transaction-documents');

-- Allow all authenticated users to delete
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'transaction-documents');
```

**Done!** Uploads will work with proper security.

---

## 🎯 Recommended: Option 1 (Disable RLS)

For a single-user or trusted environment, disabling RLS is simpler and works perfectly.

The policies in Option 2 are already very permissive (all authenticated users can do everything), so disabling RLS is effectively the same security level but simpler.

---

## ✅ Test Upload

After applying the fix:

1. Go to **Transactions**
2. Click any transaction to expand
3. Scroll to **"📎 Receipts & Invoices"**
4. Click **"📷 Upload / Take Photo"**
5. Select a file
6. Should upload successfully! ✨

---

## 🔍 Verify It's Fixed

If upload works, you'll see:
- ✅ "Document uploaded" toast message
- ✅ File appears in the list
- ✅ No console errors

If still getting errors:
- Check bucket name is exactly: `transaction-documents`
- Check RLS is disabled OR policies are added
- Check you're logged in (authenticated)

---

**Quick fix: Just disable RLS on the bucket!** 🚀
