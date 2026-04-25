# 📷 Receipt & Invoice Upload - LIVE!

## 🎉 What's New

**Upload receipts, invoices, and documents directly to transactions!**

- 📷 **Take photos** with your phone camera
- 📤 **Upload images** (JPG, PNG, etc.)
- 📄 **Upload PDFs** (invoices, receipts)
- 👁️ **View documents** anytime
- 🗑️ **Delete** when needed

## 🚀 Live Now

**https://fleet-os-nine.vercel.app**

## 📋 Setup Required

### Step 1: Run SQL

Run this in Supabase SQL Editor:

```sql
-- CREATE DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS transaction_documents (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CREATE INDEX
CREATE INDEX IF NOT EXISTS idx_transaction_documents_transaction_id ON transaction_documents(transaction_id);

-- DISABLE RLS
ALTER TABLE transaction_documents DISABLE ROW LEVEL SECURITY;
```

Or just run: `files/ADD_DOCUMENT_STORAGE.sql`

### Step 2: Create Storage Bucket

**In Supabase Dashboard:**

1. Go to **Storage** section
2. Click **"New bucket"**
3. Name it: `transaction-documents`
4. Set to **PUBLIC** (or configure RLS if you prefer)
5. Click **Create**

**Done!** ✅

## ✨ How to Use

### Upload a Document:

1. **Click any transaction** to expand it
2. **Scroll to "📎 Receipts & Invoices"** section
3. **Click "📷 Upload / Take Photo"**
4. **Choose:**
   - **Take Photo** (on mobile - opens camera)
   - **Choose File** (select from device)
5. **Document uploads** automatically
6. **Appears in list** below

### View a Document:

- **Click "View"** button on any document
- Opens in new tab
- Works for images and PDFs

### Delete a Document:

- **Click "×"** button
- Confirms deletion
- Removes from storage and database

## 📱 Mobile Features

### Camera Support:

On mobile devices, the upload button will:
- **Open camera directly** for quick photos
- **Or let you choose** from gallery
- **Optimized for receipts** and invoices

### File Types Supported:

- **Images:** JPG, JPEG, PNG, GIF, WebP, HEIC
- **Documents:** PDF
- **All common formats** accepted

## 🎯 Features

- ✅ **Unlimited uploads** per transaction
- ✅ **Camera integration** on mobile
- ✅ **File size shown** (in KB)
- ✅ **Upload date** displayed
- ✅ **Icon indicators** (📷 for images, 📄 for PDFs)
- ✅ **View in new tab**
- ✅ **Delete with confirmation**
- ✅ **Auto-deletes** when transaction deleted

## 💡 Use Cases

Perfect for:
- **Parts receipts** from suppliers
- **Mechanic invoices**
- **MOT certificates**
- **Service records**
- **Warranty documents**
- **Purchase invoices**
- **Proof of payment**
- **Any transaction documentation**

## 🔧 Technical Details

### Storage:
- Files stored in Supabase Storage bucket
- Organized by account ID: `{accountId}/tx-{txId}-{timestamp}.{ext}`
- Public URLs for easy viewing
- Automatic cleanup on transaction delete (CASCADE)

### Database:
- `transaction_documents` table links files to transactions
- Stores: filename, path, type, size, upload date
- Indexed for fast lookups

### Security:
- Files organized by account
- Only accessible via transaction
- Can add RLS policies if needed

## 📊 Display

Documents show:
- **Icon** (📷 or 📄)
- **Filename**
- **File size** in KB
- **Upload date** (e.g., "25 Apr")
- **View** and **Delete** buttons

## 🎨 UI

Clean, organized layout:
- Blue theme to match document icons
- Separate section below transaction details
- Upload button with hidden file input
- Progress indicator during upload
- Empty state when no documents

## ⚡ Performance

- **Async uploads** - doesn't block UI
- **Optimized loading** - only loads when transaction expanded
- **Efficient storage** - organized folder structure
- **Fast viewing** - direct public URLs

**Never lose a receipt again!** 📎✨
