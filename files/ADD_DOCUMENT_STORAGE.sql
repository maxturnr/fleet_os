-- ═══════════════════════════════════════════════════════════
-- ADD DOCUMENT STORAGE FOR RECEIPTS/INVOICES
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. CREATE DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS transaction_documents (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREATE INDEX
CREATE INDEX IF NOT EXISTS idx_transaction_documents_transaction_id ON transaction_documents(transaction_id);

-- 3. DISABLE RLS
ALTER TABLE transaction_documents DISABLE ROW LEVEL SECURITY;

-- 4. VERIFY
SELECT 
  'Document storage table created!' as status,
  (SELECT COUNT(*) FROM transaction_documents) as documents_count;

-- ═══════════════════════════════════════════════════════════
-- NEXT STEPS - DO THIS IN SUPABASE DASHBOARD:
-- ═══════════════════════════════════════════════════════════
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create a new bucket called: transaction-documents
-- 3. IMPORTANT: Set RLS to DISABLED or run the policies below
-- 4. Done!

-- ═══════════════════════════════════════════════════════════
-- STORAGE BUCKET RLS POLICIES (Run after creating bucket)
-- ═══════════════════════════════════════════════════════════

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

-- OR SIMPLER: Just disable RLS on the bucket in the dashboard
-- Storage > transaction-documents > Configuration > RLS = OFF
